import type InitiativeTracker from "src/main";
import type { SRDMonster } from "src/types/creatures";
import type { Creature } from "./creature";
import { DECIMAL_TO_VULGAR_FRACTION } from "./constants";
import { setIcon } from "obsidian";

export * from "./constants";
export * from "./icons";
export * from "./conditions";
export { getRpgSystem, RpgSystemSetting } from "./rpg-system";

export function convertFraction(s: string | number): number {
    if (typeof s == "number") return s;
    if (typeof s != "string") return null;
    if (!s || s == "undefined" || !s.length) return 0;

    let split = s.split("/");
    if (split.length == 1) {
        if (isNaN(Number(s))) {
            return 0;
        }
        return Number(s);
    }
    return Number(split[0]) / Number(split[1]);
}

export function crToString(cr: string | number): string {
    if (typeof cr == "string") cr = convertFraction(cr);
    if (cr == 0) return "0";
    const decimalPart = cr % 1;
    const wholePart = Math.floor(cr);
    if (decimalPart == 0) return wholePart.toString();
    let str = wholePart == 0 ? "" : wholePart.toString();
    if (decimalPart in DECIMAL_TO_VULGAR_FRACTION) {
        str += DECIMAL_TO_VULGAR_FRACTION[decimalPart];
    } else {
        str += decimalPart.toString().slice(1);
    }
    return str;
}

export function PF2LevelToNumber(lvl_field: string | number): [number, string] {
    if (typeof lvl_field == "string") {
        const type = lvl_field.split(" ")
                        .slice(0, -1)
                        .join(" ");
        const lvl = parseInt(lvl_field.split(" ")
                             .slice(-1).join(""));

        return [lvl, type];
    }
    
    return [lvl_field, "Creature"];
}

export function getFromCreatureOrBestiary<T>(
    plugin: InitiativeTracker,
    creature: Creature | SRDMonster,
    getter: (creature: Creature | SRDMonster | null) => T
): T {
    const fromBase = getter(creature);
    if (fromBase) return fromBase;
    return getter(plugin.getCreatureFromBestiary(creature.name));
}

export const buildLoader = (text: string): HTMLDivElement => {
    const loading = createDiv({
        cls: "is-loading"
    });
    setIcon(loading.createDiv("spinner"), "loader-2");
    loading.createEl("em", {
        text
    });
    return loading;
};
