import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { VisualFormattingSettingsModel } from "./settings";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import DataView = powerbi.DataView;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import DataViewValueColumn = powerbi.DataViewValueColumn;

import "../style/visual.less";

// --- Interfaces ---

type BarType = "step" | "subtotal" | "total" | "bar";

interface StackedValue {
    measureName: string;
    value: number;
    color: string;
}

interface BarData {
    category: string;
    barType: BarType;
    sequence: number;
    stackedValues: StackedValue[];
    totalValue: number;
    startY: number;
    endY: number;
    xPosition: number;
}

// --- Visual Class ---

export class Visual implements IVisual {
    private target: HTMLElement;
    private svgContainer: SVGSVGElement;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private host: IVisualHost;
    private bars: BarData[];

    constructor(options: VisualConstructorOptions) {
        this.formattingSettingsService = new FormattingSettingsService();
        this.target = options.element;
        this.host = options.host;
        this.bars = [];

        // Create SVG container
        const svgNS = "http://www.w3.org/2000/svg";
        this.svgContainer = document.createElementNS(svgNS, "svg") as SVGSVGElement;
        this.svgContainer.setAttribute("class", "hybrid-waterfall-chart");
        this.target.appendChild(this.svgContainer);
    }

    public update(options: VisualUpdateOptions): void {
        // Populate formatting settings
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualFormattingSettingsModel,
            options.dataViews?.[0]
        );

        const dataView = options.dataViews?.[0];
        if (!dataView || !dataView.categorical) {
            this.renderEmptyState(options.viewport.width, options.viewport.height);
            return;
        }

        // Parse data
        this.bars = this.parseData(dataView);

        if (this.bars.length === 0) {
            this.renderEmptyState(options.viewport.width, options.viewport.height);
            return;
        }

        // Compute positions
        this.computeBarPositions(options.viewport.width, options.viewport.height);

        // Render chart
        this.renderChart(options.viewport.width, options.viewport.height);
    }

    // --- Data Parsing ---

    private parseData(dataView: DataView): BarData[] {
        const categorical = dataView.categorical;
        if (!categorical || !categorical.categories || categorical.categories.length < 2) {
            return [];
        }

        const categoryColumn = categorical.categories[0];
        const barTypeColumn = categorical.categories[1];
        const sequenceColumn = categorical.categories.length > 2 ? categorical.categories[2] : null;
        const valueColumns = categorical.values || [];

        const bars: BarData[] = [];
        const colorPalette = this.host.colorPalette;
        const defaultColor = this.formattingSettings.colorSettings.defaultBarColor.value.value;

        for (let i = 0; i < categoryColumn.values.length; i++) {
            const category = String(categoryColumn.values[i] || "");
            const barTypeRaw = String(barTypeColumn.values[i] || "step").toLowerCase();
            const sequence = sequenceColumn ? Number(sequenceColumn.values[i]) || i : i;

            // Map bar type
            let barType: BarType = "step";
            if (barTypeRaw === "subtotal") barType = "subtotal";
            else if (barTypeRaw === "total") barType = "total";
            else if (barTypeRaw === "bar") barType = "bar";

            // Collect stacked values
            const stackedValues: StackedValue[] = [];
            let totalValue = 0;

            for (let v = 0; v < valueColumns.length; v++) {
                const valueCol = valueColumns[v] as DataViewValueColumn;
                const val = Number(valueCol.values[i]) || 0;
                if (val !== 0) {
                    const measureName = valueCol.source.displayName || `Value ${v + 1}`;
                    const color = colorPalette.getColor(measureName).value || defaultColor;
                    stackedValues.push({
                        measureName,
                        value: val,
                        color
                    });
                    totalValue += val;
                }
            }

            bars.push({
                category,
                barType,
                sequence,
                stackedValues,
                totalValue,
                startY: 0,
                endY: 0,
                xPosition: 0
            });
        }

        // Sort bars by sequence
        bars.sort((a, b) => a.sequence - b.sequence);

        return bars;
    }

    // --- Position Calculation ---

    private computeBarPositions(viewportWidth: number, viewportHeight: number): void {
        const chartSettings = this.formattingSettings.chartSettings;
        const margin = { left: 50, right: 20 };

        // Calculate available width and dynamic bar dimensions
        const availableWidth = viewportWidth - margin.left - margin.right;
        const numBars = this.bars.length;

        // Calculate bar width and gap to fill the available space
        // Gap is proportional to bar width (approximately barGap.value / barWidth.value ratio)
        const gapRatio = chartSettings.barGap.value / chartSettings.barWidth.value;
        const totalUnits = numBars + (numBars - 1) * gapRatio; // Each bar = 1 unit, each gap = gapRatio units
        const dynamicBarWidth = Math.min(availableWidth / totalUnits, chartSettings.barWidth.value * 2); // Cap at 2x the setting
        const dynamicBarGap = dynamicBarWidth * gapRatio;

        // Compute X positions
        let currentX = margin.left;
        for (const bar of this.bars) {
            bar.xPosition = currentX;
            currentX += dynamicBarWidth + dynamicBarGap;
        }

        // Store computed values for rendering
        (this as any)._computedBarWidth = dynamicBarWidth;
        (this as any)._computedBarGap = dynamicBarGap;

        // Compute Y positions (waterfall logic)
        let runningTotal = 0;
        let lastWaterfallEnd = 0;

        for (const bar of this.bars) {
            if (bar.barType === "step") {
                bar.startY = runningTotal;
                bar.endY = runningTotal + bar.totalValue;
                runningTotal = bar.endY;
                lastWaterfallEnd = bar.endY;
            } else if (bar.barType === "subtotal") {
                bar.startY = 0;
                bar.endY = runningTotal;
                // Don't update runningTotal for subtotal
            } else if (bar.barType === "total") {
                bar.startY = 0;
                bar.endY = runningTotal;
                // Total resets context but keeps the value
            } else if (bar.barType === "bar") {
                // Normal bar, starts from 0
                bar.startY = 0;
                bar.endY = bar.totalValue;
            }
        }
    }

    // --- Rendering ---

    private renderChart(width: number, height: number): void {
        // Clear previous content
        while (this.svgContainer.firstChild) {
            this.svgContainer.removeChild(this.svgContainer.firstChild);
        }

        this.svgContainer.setAttribute("width", String(width));
        this.svgContainer.setAttribute("height", String(height));

        const chartSettings = this.formattingSettings.chartSettings;
        const colorSettings = this.formattingSettings.colorSettings;
        const axisSettings = this.formattingSettings.axisSettings;

        // Use dynamically computed bar width
        const barWidth = (this as any)._computedBarWidth || chartSettings.barWidth.value;
        const barGap = (this as any)._computedBarGap || chartSettings.barGap.value;
        const margin = { top: 30, right: 20, bottom: 60, left: 50 };
        const chartHeight = height - margin.top - margin.bottom;

        // Find max value for Y scale
        let maxValue = 0;
        for (const bar of this.bars) {
            maxValue = Math.max(maxValue, Math.abs(bar.endY), Math.abs(bar.startY));
        }
        maxValue = maxValue || 1;

        const yScale = (value: number): number => {
            return margin.top + chartHeight - (value / maxValue) * chartHeight;
        };

        const svgNS = "http://www.w3.org/2000/svg";

        // Add pattern definitions
        const defs = document.createElementNS(svgNS, "defs");

        // Dotted pattern for subtotal/total
        const pattern = document.createElementNS(svgNS, "pattern");
        pattern.setAttribute("id", "dots-pattern");
        pattern.setAttribute("width", "6");
        pattern.setAttribute("height", "6");
        pattern.setAttribute("patternUnits", "userSpaceOnUse");

        const dot = document.createElementNS(svgNS, "circle");
        dot.setAttribute("cx", "3");
        dot.setAttribute("cy", "3");
        dot.setAttribute("r", "1.5");
        dot.setAttribute("fill", "#333");
        dot.setAttribute("opacity", "0.3");
        pattern.appendChild(dot);
        defs.appendChild(pattern);

        this.svgContainer.appendChild(defs);

        // Baseline
        const baseline = document.createElementNS(svgNS, "line");
        baseline.setAttribute("x1", String(margin.left - 10));
        baseline.setAttribute("x2", String(width - margin.right));
        baseline.setAttribute("y1", String(yScale(0)));
        baseline.setAttribute("y2", String(yScale(0)));
        baseline.setAttribute("stroke", "#CCC");
        baseline.setAttribute("stroke-width", "1");
        this.svgContainer.appendChild(baseline);

        // Find separator position (between last waterfall bar and first normal bar)
        let separatorX = -1;
        for (let i = 0; i < this.bars.length; i++) {
            if (this.bars[i].barType === "bar" && i > 0 && this.bars[i - 1].barType !== "bar") {
                separatorX = this.bars[i].xPosition - barGap / 2;
                break;
            }
        }

        // Draw separator line
        if (separatorX > 0) {
            const separator = document.createElementNS(svgNS, "line");
            separator.setAttribute("x1", String(separatorX));
            separator.setAttribute("x2", String(separatorX));
            separator.setAttribute("y1", String(margin.top));
            separator.setAttribute("y2", String(height - margin.bottom));
            separator.setAttribute("stroke", colorSettings.separatorColor.value.value);
            separator.setAttribute("stroke-width", "2");
            separator.setAttribute("stroke-dasharray", "6,4");
            this.svgContainer.appendChild(separator);
        }

        // Draw connectors (for waterfall)
        if (chartSettings.showConnectors.value) {
            for (let i = 0; i < this.bars.length - 1; i++) {
                const current = this.bars[i];
                const next = this.bars[i + 1];

                // Only draw connector if both are waterfall-type bars
                if (current.barType === "step" && next.barType === "step") {
                    const connector = document.createElementNS(svgNS, "line");
                    connector.setAttribute("x1", String(current.xPosition + barWidth));
                    connector.setAttribute("x2", String(next.xPosition));
                    connector.setAttribute("y1", String(yScale(current.endY)));
                    connector.setAttribute("y2", String(yScale(current.endY)));
                    connector.setAttribute("stroke", colorSettings.connectorColor.value.value);
                    connector.setAttribute("stroke-width", "1");
                    connector.setAttribute("stroke-dasharray", "3,2");
                    this.svgContainer.appendChild(connector);
                }
            }
        }

        // Draw bars
        for (const bar of this.bars) {
            const barGroup = document.createElementNS(svgNS, "g");
            barGroup.setAttribute("class", `bar-group bar-type-${bar.barType}`);

            const barTopY = yScale(bar.endY);
            const barBottomY = yScale(bar.startY);
            const barHeight = Math.abs(barBottomY - barTopY);

            // Determine bar color and pattern
            let fillColor = colorSettings.defaultBarColor.value.value;
            let usePattern = false;

            if (bar.barType === "subtotal") {
                fillColor = colorSettings.subtotalColor.value.value;
                usePattern = colorSettings.usePatternForSubtotal.value;
            } else if (bar.barType === "total") {
                fillColor = colorSettings.totalColor.value.value;
                usePattern = colorSettings.usePatternForTotal.value;
            }

            // Draw stacked segments or single bar
            if (bar.stackedValues.length > 1 && !usePattern) {
                // Stacked bar
                let currentStackY = bar.startY;
                for (const stack of bar.stackedValues) {
                    const stackTopY = yScale(currentStackY + stack.value);
                    const stackBottomY = yScale(currentStackY);
                    const stackHeight = Math.abs(stackBottomY - stackTopY);

                    const rect = document.createElementNS(svgNS, "rect");
                    rect.setAttribute("x", String(bar.xPosition));
                    rect.setAttribute("y", String(Math.min(stackTopY, stackBottomY)));
                    rect.setAttribute("width", String(barWidth));
                    rect.setAttribute("height", String(Math.max(stackHeight, 1)));
                    rect.setAttribute("fill", stack.color);
                    rect.setAttribute("stroke", "#fff");
                    rect.setAttribute("stroke-width", "0.5");

                    // Tooltip
                    const title = document.createElementNS(svgNS, "title");
                    title.textContent = `${bar.category}\n${stack.measureName}: ${this.formatValue(stack.value)}`;
                    rect.appendChild(title);

                    barGroup.appendChild(rect);
                    currentStackY += stack.value;
                }
            } else {
                // Single bar (or subtotal/total with pattern)
                const rect = document.createElementNS(svgNS, "rect");
                rect.setAttribute("x", String(bar.xPosition));
                rect.setAttribute("y", String(Math.min(barTopY, barBottomY)));
                rect.setAttribute("width", String(barWidth));
                rect.setAttribute("height", String(Math.max(barHeight, 1)));
                rect.setAttribute("fill", fillColor);

                if (usePattern) {
                    // Draw base color then overlay pattern
                    const patternRect = document.createElementNS(svgNS, "rect");
                    patternRect.setAttribute("x", String(bar.xPosition));
                    patternRect.setAttribute("y", String(Math.min(barTopY, barBottomY)));
                    patternRect.setAttribute("width", String(barWidth));
                    patternRect.setAttribute("height", String(Math.max(barHeight, 1)));
                    patternRect.setAttribute("fill", "url(#dots-pattern)");
                    barGroup.appendChild(rect);
                    barGroup.appendChild(patternRect);
                } else {
                    barGroup.appendChild(rect);
                }

                // Tooltip
                const title = document.createElementNS(svgNS, "title");
                title.textContent = `${bar.category}: ${this.formatValue(bar.totalValue)}`;
                rect.appendChild(title);
            }

            // Value label
            if (chartSettings.showValues.value) {
                const label = document.createElementNS(svgNS, "text");
                label.setAttribute("x", String(bar.xPosition + barWidth / 2));
                label.setAttribute("y", String(barTopY - 5));
                label.setAttribute("text-anchor", "middle");
                label.setAttribute("font-size", String(chartSettings.valueFontSize.value));
                label.setAttribute("fill", "#333");
                label.setAttribute("font-family", "Segoe UI, sans-serif");
                label.textContent = this.formatValue(bar.totalValue);
                barGroup.appendChild(label);

                // Show stacked values inside bar if multiple
                if (bar.stackedValues.length > 1 && barHeight > 30) {
                    let stackY = bar.startY;
                    for (const stack of bar.stackedValues) {
                        const stackMidY = yScale(stackY + stack.value / 2);
                        const stackLabel = document.createElementNS(svgNS, "text");
                        stackLabel.setAttribute("x", String(bar.xPosition + barWidth / 2));
                        stackLabel.setAttribute("y", String(stackMidY + 4));
                        stackLabel.setAttribute("text-anchor", "middle");
                        stackLabel.setAttribute("font-size", String(chartSettings.valueFontSize.value - 1));
                        stackLabel.setAttribute("fill", "#fff");
                        stackLabel.setAttribute("font-family", "Segoe UI, sans-serif");
                        stackLabel.textContent = this.formatValue(stack.value);
                        barGroup.appendChild(stackLabel);
                        stackY += stack.value;
                    }
                }
            }

            this.svgContainer.appendChild(barGroup);
        }

        // X Axis labels
        if (axisSettings.showXAxis.value) {
            const rotation = axisSettings.labelRotation.value;
            for (const bar of this.bars) {
                const label = document.createElementNS(svgNS, "text");
                const labelX = bar.xPosition + barWidth / 2;
                const labelY = height - margin.bottom + 15;

                label.setAttribute("x", String(labelX));
                label.setAttribute("y", String(labelY));
                label.setAttribute("font-size", String(axisSettings.xAxisFontSize.value));
                label.setAttribute("fill", axisSettings.xAxisColor.value.value);
                label.setAttribute("font-family", "Segoe UI, sans-serif");

                if (rotation > 0) {
                    label.setAttribute("transform", `rotate(${rotation}, ${labelX}, ${labelY})`);
                    label.setAttribute("text-anchor", "start");
                } else {
                    label.setAttribute("text-anchor", "middle");
                }

                label.textContent = bar.category;
                this.svgContainer.appendChild(label);
            }
        }
    }

    private formatValue(value: number): string {
        if (value === null || value === undefined) return "";
        if (value === 0) return "0";

        const abs = Math.abs(value);
        const sign = value < 0 ? "-" : "";

        if (abs >= 1000000000) {
            return sign + (abs / 1000000000).toFixed(1) + "B";
        } else if (abs >= 1000000) {
            const formatted = abs / 1000000;
            return sign + (formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(2)) + "M";
        } else if (abs >= 1000) {
            const formatted = abs / 1000;
            return sign + (formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(2)) + "K";
        }
        return value.toFixed(2).replace(/\.?0+$/, "");
    }

    private renderEmptyState(width: number, height: number): void {
        while (this.svgContainer.firstChild) {
            this.svgContainer.removeChild(this.svgContainer.firstChild);
        }

        this.svgContainer.setAttribute("width", String(width));
        this.svgContainer.setAttribute("height", String(height));

        const svgNS = "http://www.w3.org/2000/svg";
        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", String(width / 2));
        text.setAttribute("y", String(height / 2));
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("fill", "#666");
        text.setAttribute("font-size", "14");
        text.setAttribute("font-family", "Segoe UI, sans-serif");
        text.textContent = "Add Category, Bar Type and Values to display the chart";
        this.svgContainer.appendChild(text);
    }

    // --- Formatting Pane ---

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
