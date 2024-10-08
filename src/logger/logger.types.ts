
export interface UpdateLogMessage {
    name: string;
    hp: number | null;
    temp: boolean;
    status: string[] | null;
    remove_status: string[] | null;
    max: boolean;
    saved: boolean;
    unc: boolean;
    ac: string;
    ac_add: boolean;
}
