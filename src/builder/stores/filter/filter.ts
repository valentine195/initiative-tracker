import copy from "fast-copy";
import type { SRDMonster } from "src/types/creatures";
import { prepareSimpleSearch, type SearchResult } from "obsidian";
import type InitiativeTracker from "src/main";
import { convertFraction, PF2LevelToNumber} from "src/utils";
import { getId } from "src/utils/creature";
import {
    derived,
    get,
    type Readable,
    type Updater,
    type Writable,
    writable
} from "svelte/store";

export enum FilterType {
    Range,
    PF2_Level_Range, 
    PF2_Monster_Type,
    Search,
    Options, 
    PF2_Trait
}

interface BaseFilter {
    type: FilterType;
    fields: string[];
    text: string;
    id: string;
    derive: boolean;
}
interface RangeFilter extends BaseFilter {
    type: FilterType.Range;
    options: [number, number];
}
interface PF2_Level_RangeFilter extends BaseFilter {
    type: FilterType.PF2_Level_Range;
    options: [number, number];
}
interface PF2_Monster_TypeFilter extends BaseFilter {
    type: FilterType.PF2_Monster_Type;
    options: string;
}
interface OptionsFilter extends BaseFilter {
    type: FilterType.Options;
    options: string[];
}
interface StringFilter extends BaseFilter {
    type: FilterType.Search;
    options: string;
}
interface PF2_TraitFilter extends BaseFilter {
    type: FilterType.PF2_Trait;
    options: string;
}
export type Filter = RangeFilter | PF2_Level_RangeFilter | OptionsFilter | StringFilter | PF2_TraitFilter | PF2_Monster_TypeFilter;
export const DEFAULT_NEW_FILTER: Filter = {
    type: FilterType.Search,
    fields: [],
    text: "New Filter",
    options: "",
    id: getId(),
    derive: false
};

interface BaseFilterStore<T extends Filter, S> extends Writable<T["options"]> {
    isDefault: Readable<boolean>;
    getIsDefault: () => boolean;
    reset: () => void;
    compare: (value: S) => boolean;
    filter: Filter;
    type: T["type"];
    options: T["options"];
    text: T["text"];
}
export interface RangeFilterStore
    extends BaseFilterStore<RangeFilter, number | string> {
    type: FilterType.Range;
}
export interface PF2_Level_RangeFilterStore
    extends BaseFilterStore<PF2_Level_RangeFilter, number | string> {
    type: FilterType.PF2_Level_Range;
}
export interface PF2_Monster_TypeFilterStore
    extends BaseFilterStore<PF2_Monster_TypeFilter, number | string> {
    type: FilterType.PF2_Monster_Type;
}
export interface OptionsFilterStore
    extends BaseFilterStore<OptionsFilter, number | string> {
    type: FilterType.Options;
}
export interface StringFilterStore
    extends BaseFilterStore<StringFilter, number | string> {
    type: FilterType.Search;
}
export interface PF2_TraitFilterStore
    extends BaseFilterStore<PF2_TraitFilter, number | string> {
    type: FilterType.PF2_Trait;
}

type FilterStore = RangeFilterStore | PF2_Level_RangeFilterStore | OptionsFilterStore | StringFilterStore | PF2_TraitFilterStore | PF2_Monster_TypeFilterStore;

type FilterFactory<T extends Filter> = (filter: T) => FilterStore;

const createRangeFilter: FilterFactory<RangeFilter> = (filter) => {
    const store = writable<[number, number]>([...filter.options]);
    const { update, set, subscribe } = store;
    const isDefault = derived(store, (existing) => {
        if (
            filter.options[0] == existing[0] &&
            filter.options[1] == existing[1]
        )
            return true;
        return false;
    });
    return {
        isDefault,
        getIsDefault: () => get(isDefault),

        update,
        set,
        subscribe,

        reset: () => set([...filter.options]),

        compare: (value: number | string) => {
            if (get(isDefault)) return true;
            const values = get(store);
            return (
                convertFraction(value) >= values[0] &&
                convertFraction(value) <= values[1]
            );
        },
        filter,
        ...filter
    };
};


const createPF2_Level_RangeFilter: FilterFactory<PF2_Level_RangeFilter> = (filter) => {
    const store = writable<[number, number]>([...filter.options]);
    const { update, set, subscribe } = store;
    const isDefault = derived(store, (existing) => {
        if (
            filter.options[0] == existing[0] &&
            filter.options[1] == existing[1]
        )
            return true;
        return false;
    });
    return {
        isDefault,
        getIsDefault: () => get(isDefault),

        update,
        set,
        subscribe,

        reset: () => set([...filter.options]),

        compare: (value: number | string) => {
            if (get(isDefault)) return true;
            const values = get(store);
            return (
                PF2LevelToNumber(value)[0] >= values[0] &&
                PF2LevelToNumber(value)[0] <= values[1]
            );
        },
        filter,
        ...filter
    };
};

const createPF2_Monster_TypeFilter: FilterFactory<PF2_Monster_TypeFilter> = (filter) => {
    let DEFAULT_STRING: string = "";
    const store = writable<string>(DEFAULT_STRING);
    const { subscribe, set, update } = store;

    const isDefault = derived(store, (existing) => {
        return !existing.length;
    });
    let search = prepareSimpleSearch("");
    store.subscribe((value) => (search = prepareSimpleSearch(value)));
    return {
        isDefault,
        getIsDefault: () => get(isDefault),
        subscribe,
        set,
        reset: () => set(DEFAULT_STRING),
        compare: (value: number | string) => {
            if (get(isDefault)) return true;
            if (typeof value === "number") return false;
            return get(isDefault) || search(PF2LevelToNumber(value)[1]) != null;
        },
        update,
        filter,
        ...filter
    };
};
function normalize(str: string): string {
    if (typeof str !== "string") return str;
    return str.toLowerCase();
}
const createOptionsFilter: FilterFactory<OptionsFilter> = (filter) => {
    const store = writable<string[]>([]);
    const { subscribe, set, update } = store;

    const isDefault = derived(store, (existing) => {
        return !existing.length;
    });
    return {
        isDefault,
        getIsDefault: () => get(isDefault),
        subscribe,
        set,
        reset: () => set([]),
        compare: (value: number | string | Array<string>) => {
            if (get(isDefault)) return true;
            if (typeof value === "number") return false;
            const values = get(store);
            if (Array.isArray(value)) {
                return value.some((v) => values.includes(normalize(v)));
            }
            return values.includes(normalize(value));
        },
        update,
        filter,
        ...filter
    };
};

const createStringFilter: FilterFactory<StringFilter> = (filter) => {
    let DEFAULT_STRING: string = "";
    const store = writable<string>(DEFAULT_STRING);
    const { subscribe, set, update } = store;

    const isDefault = derived(store, (existing) => {
        return !existing.length;
    });
    let search = prepareSimpleSearch("");
    store.subscribe((value) => (search = prepareSimpleSearch(value)));
    return {
        isDefault,
        getIsDefault: () => get(isDefault),
        subscribe,
        set,
        reset: () => set(DEFAULT_STRING),
        compare: (value: number | string) => {
            if (get(isDefault)) return true;
            if (typeof value === "number") return false;
            return get(isDefault) || search(value) != null;
        },
        update,
        filter,
        ...filter
    };
};

const createPF2_TraitFilter: FilterFactory<PF2_TraitFilter> = (filter) => {
    let DEFAULT_STRING: string = "";
    const store = writable<string>(DEFAULT_STRING);
    const { subscribe, set, update } = store;

    const isDefault = derived(store, (existing) => {
        return !existing.length;
    });
    let search = prepareSimpleSearch("");
    store.subscribe((value) => (search = prepareSimpleSearch(value)));
    return {
        isDefault,
        getIsDefault: () => get(isDefault),
        subscribe,
        set,
        reset: () => set(DEFAULT_STRING),
        compare: (value: number | string) => {
            if (get(isDefault)) return true;
            if (typeof value === "number") return false;
            return get(isDefault) || search(value) != null;
        },
        update,
        filter,
        ...filter
    };
};


function getFilterStore(filter: Filter) {
    switch (filter.type) {
        case FilterType.Options:
            return createOptionsFilter(filter);
        case FilterType.Range:
            return createRangeFilter(filter);
        case FilterType.PF2_Level_Range:
            return createPF2_Level_RangeFilter(filter);
        case FilterType.PF2_Monster_Type:
            return createPF2_Monster_TypeFilter(filter);
        case FilterType.Search:
            return createStringFilter(filter);
        case FilterType.PF2_Trait:
            return createPF2_TraitFilter(filter);
    }
}
export type BuiltFilterStore = ReturnType<typeof createFilterStore>;

function getDerivedFilterOptions(
    creatures: SRDMonster[],
    filters: Filter[]
): Map<Filter, Set<any>> {
    const options = new Map(filters.map((f) => [f, new Set()]));
    for (const creature of creatures) {
        for (const filter of filters) {
            for (const field of filter.fields) {
                if (field in creature) {
                    switch (filter.type) {
                        case FilterType.Range: {
                            let fieldAsNumber = convertFraction(
                                creature[field]
                            );
                            if (fieldAsNumber == null || isNaN(fieldAsNumber))
                                continue;
                            const current = [
                                ...options.get(filter)
                            ] as number[];
                            if (!current.length) {
                                current[0] = Infinity;
                                current[1] = -Infinity;
                            }
                            current[0] = Math.min(current[0], fieldAsNumber);
                            if (
                                Math.max(current[1], fieldAsNumber) !=
                                current[0]
                            ) {
                                current[1] = Math.max(
                                    current[1],
                                    fieldAsNumber
                                );
                            }

                            options.set(filter, new Set(current));
                            break;
                        }
                        case FilterType.PF2_Level_Range: {
                            let fieldAsNumber = PF2LevelToNumber(
                                creature[field]
                            )[0];
                            if (fieldAsNumber == null || isNaN(fieldAsNumber))
                                continue;
                            const current = [
                                ...options.get(filter)
                            ] as number[];
                            if (!current.length) {
                                current[0] = Infinity;
                                current[1] = -Infinity;
                            }
                            current[0] = Math.min(current[0], fieldAsNumber);
                            if (
                                Math.max(current[1], fieldAsNumber) !=
                                current[0]
                            ) {
                                current[1] = Math.max(
                                    current[1],
                                    fieldAsNumber
                                );
                            }

                            options.set(filter, new Set(current));
                            break;
                        }
                        case FilterType.Options: {
                            if (Array.isArray(creature[field])) {
                                for (const value of creature[field]) {
                                    options.get(filter).add(normalize(value));
                                }
                            } else if (typeof creature[field] === "string") {
                                options
                                    .get(filter)
                                    .add(normalize(creature[field]));
                            }
                            break;
                        }
                        case FilterType.Search:
                        case FilterType.PF2_Monster_Type:
                        case FilterType.PF2_Trait:
                            continue;
                    }
                    continue;
                }
            }
        }
    }
    return options;
}

export function createFilterStore(
    creatures: Writable<SRDMonster[]>,
    plugin: InitiativeTracker
) {
    const buildAndSubscribe = (filter: Filter) => {
        const store = getFilterStore(filter);
        map.set(filter.id, store);
        subscriptions.set(
            filter.id,
            store.subscribe((_) => {
                filters$.update((f) => f);
            })
        );
        return store;
    };

    const map = new Map<string, FilterStore>();
    const filters$ = writable(map);
    const filterMap: Map<string, Filter> = new Map();
    filters$.subscribe((f) => {
        for (const [id, filter] of f) {
            filterMap.set(id, filter.filter);
        }
    });

    const subscriptions = new Map();
    if (!plugin.data.builder) {
        plugin.data.builder = {
            sidebarIcon: true,
            showParty: true,
            showXP: true
        };
    }
    const getDefaultLayout = () => {
        return copy(
            plugin.data.builder?.filters?.layout ?? ORIGINAL_DEFAULT_LAYOUT
        );
    };
    const getDefaultFilters = () => {
        return copy(plugin.data.builder?.filters?.filters ?? DEFAULT_FILTERS);
    };
    if (!plugin.data.builder.filters) {
        plugin.data.builder.filters = {
            filters: getDefaultFilters(),
            layout: getDefaultLayout()
        };
    }
    const filters = plugin.data.builder?.filters?.filters ?? DEFAULT_FILTERS;
    const layouts = plugin.data.builder?.filters?.layout ?? getDefaultLayout();
    const needToDerive = filters.filter((f) => f.derive);
    if (needToDerive.length) {
        const options = getDerivedFilterOptions(get(creatures), filters);
        for (const [filter, set] of options) {
            filter.options = Array.from(set) as any[];
        }
    }
    for (const filter of filters) {
        buildAndSubscribe(filter);
    }
    const filtered = derived([creatures, filters$], ([creatures, filters$]) => {
        const filtered: SRDMonster[] = [];
        const filters = Array.from(filters$.values());
        for (const creature of creatures) {
            if (
                filters.every((filter) => {
                    if (!filter.filter.fields.length) return true;
                    switch (filter.filter.type){
                        case FilterType.PF2_Trait: {
                            return Object.keys(creature).some((field) => {
                                return filter.filter.fields.some((filter_field) =>{
                                    if(field.startsWith(filter_field + '_')) {
                                        return filter.compare(creature[field]);
                                    };
                            });
                        });
                        }
                        default: {
                            for (const field of filter.filter.fields) {
                                if (!(field in creature)) continue;
                                return filter.compare(creature[field]);
                            }
                        }
                    }
                    return true;
                })
            ) {
                filtered.push(creature);
            }
        }
        return filtered;
    });

    const layout = writable(layouts ?? getDefaultLayout());
    const setLayout = (newLayout: FilterLayout) => {
        layout.set(newLayout);
        plugin.data.builder.filters.layout = newLayout;
        plugin.saveSettings();
    };
    const resetLayout = (def?: boolean) => {
        setLayout(def ? ORIGINAL_DEFAULT_LAYOUT : getDefaultLayout());
        updateAndSave((f) => {
            f.clear();
            const filters = def ? DEFAULT_FILTERS : getDefaultFilters();
            for (const filter of filters) {
                buildAndSubscribe(filter);
            }
            return f;
        });
    };
    function updateAndSave(updater: Updater<Map<string, FilterStore>>) {
        filters$.update((filters) => {
            const updated = updater(filters);
            plugin.data.builder.filters.filters = [...updated.values()].map(
                (f) => f.filter
            );
            plugin.saveSettings();
            return updated;
        });
    }
    const active = derived(filters$, (filters$) => {
        let active = 0;
        for (const filter of filters$.values()) {
            if (!filter.getIsDefault()) {
                active++;
            }
        }
        return active;
    });

    const name: StringFilterStore = buildAndSubscribe(
        NAME_FILTER
    ) as StringFilterStore;

    const add = (filter: Filter, filters: Map<string, FilterStore>) => {
        if (filter.derive) {
            const options = getDerivedFilterOptions(get(creatures), [filter]);
            for (const [filter, set] of options) {
                filter.options = Array.from(set) as any[];
            }
        }
        const store = getFilterStore(filter);
        filters.set(filter.id, store);
        subscriptions.set(
            filter.id,
            store.subscribe((_) => filters$.update((f) => f))
        );
        return filters;
    };
    const remove = (filter: string, filters: Map<string, FilterStore>) => {
        filters.delete(filter);
        if (subscriptions.has(filter)) {
            subscriptions.get(filter)();
            subscriptions.delete(filter);
        }
        return filters;
    };
    return {
        add: (filter: Filter) =>
            updateAndSave((filters) => add(filter, filters)),
        update: (id: string, newFilter: Filter) =>
            updateAndSave((filters) => {
                remove(id, filters);
                return add(newFilter, filters);
            }),
        remove: (filter: Filter) =>
            updateAndSave((filters) => remove(filter.id, filters)),
        reset: () =>
            updateAndSave((filters) => {
                for (const filter of filters.values()) {
                    filter.reset();
                }
                return filters;
            }),
        active,
        filtered,
        filters: filters$,
        filterMap,

        layout: {
            subscribe: layout.subscribe,
            set: setLayout
        },
        resetLayout,
        getOrDefault(id: string): Filter {
            return filterMap?.get(id) ?? copy(DEFAULT_NEW_FILTER);
        },

        name
    };
}

export const name = writable<string>();

const NAME_FILTER: StringFilter = {
    type: FilterType.Search,
    text: "Name",
    fields: ["name"],
    options: "",
    id: "ID_DEFAULT_NAME_FILTER",
    derive: false
};

export const DEFAULT_FILTERS: Filter[] = [
    {
        type: FilterType.PF2_Level_Range,
        text: "Level",
        fields: ["level"],
        options: [-1, 30],
        id: "ID_DEFAULT_PF2_LVL_FILTER",
        derive: true
    },
    {
        type: FilterType.PF2_Trait,
        text: "Trait",
        fields: ["trait"],
        options: "",
        id: "ID_DEFAULT_PF2_TRAIT_FILTER",
        derive: true
    },
    {
        type: FilterType.Search,
        text: "Source",
        fields: ["source"],
        options: "",
        id: "ID_DEFAULT_PF2_SOURCE_FILTER",
        derive: true
    },
    {
        type: FilterType.PF2_Monster_Type,
        text: "Type",
        fields: ["level"],
        options: "",
        id: "ID_DEFAULT_PF2_CREATURE_TYPE_FILTER",
        derive: true
    }
];

const ORIGINAL_DEFAULT_LAYOUT: FilterLayout = [
    {
        id: "ID_DEFAULT_LVL_LAYOUT",
        type: "nested",
        nested: [{ id: "ID_DEFAULT_PF2_LVL_FILTER", type: "filter" }]
    },
    {
        id: "ID_DEFAULT_NESTED_LAYOUT",
        type: "nested",
        nested: [
            { id: "ID_DEFAULT_PF2_TRAIT_FILTER", type: "filter" },
            { id: "ID_DEFAULT_PF2_SOURCE_FILTER", type: "filter" }
        ]
        
    },
    {
        id: "ID_DEFAULT_NESTED_LAYOUT_2",
        type: "nested",
        nested: [{ id: "ID_DEFAULT_PF2_CREATURE_TYPE_FILTER", type: "filter" }]
    }
];

export type BaseLayoutItem = {
    id: string; //filter id
    type: "filter" | "nested";
};
export type FilterLayoutItem = {
    id: string; //filter id
    type: "filter";
};
export type NestedFilterLayoutItem = BaseLayoutItem & {
    nested: FilterLayoutItem[];
    type: "nested";
};
export type LayoutItem = NestedFilterLayoutItem | FilterLayoutItem;

export type FilterLayout = NestedFilterLayoutItem[];
