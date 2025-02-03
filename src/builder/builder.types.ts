import type { Filter, FilterLayout } from "src/builder/stores/filter/filter";

export interface BuilderState {
    sidebarIcon: boolean;
    showXP: boolean;
    showParty: boolean;
    headers?: TableHeaderState[];
    filters?: {
        layout: FilterLayout;
        filters: Filter[];
    };
}
export enum SortFunctions {
    LOCAL_COMPARE,
    CONVERT_FRACTION,
    PF2_LEVEL,
    PF2_TYPE, 
    PF2_TRAIT,
    CUSTOM
}
export type TableHeaderState = {
    text: string;
    field: string;
    type: SortFunctions;
    func?: string;
};
export interface BuilderPartyPlayer {
    level: number;
    enabled: boolean;
    name: string;
}
export interface BuilderGenericPlayer {
    level: number;
    enabled: boolean;
    amount: number;
}

export type BuilderPlayer = BuilderPartyPlayer | BuilderGenericPlayer;
