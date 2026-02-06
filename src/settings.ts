import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import powerbi from "powerbi-visuals-api";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

/**
 * Chart display settings
 */
class ChartSettingsCard extends FormattingSettingsCard {
    barWidth = new formattingSettings.NumUpDown({
        name: "barWidth",
        displayName: "Bar Width",
        value: 40,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 15 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 100 }
        }
    });

    barGap = new formattingSettings.NumUpDown({
        name: "barGap",
        displayName: "Bar Gap",
        value: 10,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 2 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 50 }
        }
    });

    showValues = new formattingSettings.ToggleSwitch({
        name: "showValues",
        displayName: "Show Values",
        value: true
    });

    valueFontSize = new formattingSettings.NumUpDown({
        name: "valueFontSize",
        displayName: "Value Font Size",
        value: 10,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 7 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 18 }
        }
    });

    showConnectors = new formattingSettings.ToggleSwitch({
        name: "showConnectors",
        displayName: "Show Connectors",
        value: true
    });

    name: string = "chartSettings";
    displayName: string = "Chart Settings";
    slices: Array<FormattingSettingsSlice> = [
        this.barWidth,
        this.barGap,
        this.showValues,
        this.valueFontSize,
        this.showConnectors
    ];
}

/**
 * Color settings
 */
class ColorSettingsCard extends FormattingSettingsCard {
    defaultBarColor = new formattingSettings.ColorPicker({
        name: "defaultBarColor",
        displayName: "Default Bar Color",
        value: { value: "#4472C4" }
    });

    subtotalColor = new formattingSettings.ColorPicker({
        name: "subtotalColor",
        displayName: "Subtotal Color",
        value: { value: "#5B9BD5" }
    });

    totalColor = new formattingSettings.ColorPicker({
        name: "totalColor",
        displayName: "Total Color",
        value: { value: "#2B5797" }
    });

    usePatternForSubtotal = new formattingSettings.ToggleSwitch({
        name: "usePatternForSubtotal",
        displayName: "Pattern for Subtotal",
        value: true
    });

    usePatternForTotal = new formattingSettings.ToggleSwitch({
        name: "usePatternForTotal",
        displayName: "Pattern for Total",
        value: false
    });

    separatorColor = new formattingSettings.ColorPicker({
        name: "separatorColor",
        displayName: "Separator Color",
        value: { value: "#666666" }
    });

    connectorColor = new formattingSettings.ColorPicker({
        name: "connectorColor",
        displayName: "Connector Color",
        value: { value: "#999999" }
    });

    name: string = "colorSettings";
    displayName: string = "Color Settings";
    slices: Array<FormattingSettingsSlice> = [
        this.defaultBarColor,
        this.subtotalColor,
        this.totalColor,
        this.usePatternForSubtotal,
        this.usePatternForTotal,
        this.separatorColor,
        this.connectorColor
    ];
}

/**
 * Axis settings
 */
class AxisSettingsCard extends FormattingSettingsCard {
    showXAxis = new formattingSettings.ToggleSwitch({
        name: "showXAxis",
        displayName: "Show X Axis",
        value: true
    });

    xAxisFontSize = new formattingSettings.NumUpDown({
        name: "xAxisFontSize",
        displayName: "X Axis Font Size",
        value: 11,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 8 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 16 }
        }
    });

    labelRotation = new formattingSettings.NumUpDown({
        name: "labelRotation",
        displayName: "Label Rotation",
        value: 0,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 0 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 90 }
        }
    });

    xAxisColor = new formattingSettings.ColorPicker({
        name: "xAxisColor",
        displayName: "X Axis Color",
        value: { value: "#333333" }
    });

    name: string = "axisSettings";
    displayName: string = "Axis Settings";
    slices: Array<FormattingSettingsSlice> = [
        this.showXAxis,
        this.xAxisFontSize,
        this.labelRotation,
        this.xAxisColor
    ];
}

/**
 * Visual formatting settings model
 */
export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    chartSettings = new ChartSettingsCard();
    colorSettings = new ColorSettingsCard();
    axisSettings = new AxisSettingsCard();
    cards = [this.chartSettings, this.colorSettings, this.axisSettings];
}
