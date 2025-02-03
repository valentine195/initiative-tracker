<script lang="ts">
    import {
        type BuiltFilterStore,
        type FilterLayoutItem,
        FilterType,
        type LayoutItem,
        type OptionsFilterStore,
        PF2_Monster_TypeFilterStore,
        PF2_Level_RangeFilterStore,
        PF2_TraitFilterStore,
        type RangeFilterStore,
        type StringFilterStore
    } from "src/builder/stores/filter/filter";
    import { getContext } from "svelte";
    import Range from "./Range.svelte";
    import Options from "./Options.svelte";
    import Search from "./Search.svelte";

    const filterStore = getContext<BuiltFilterStore>("filters");
    const { filters } = filterStore;
    export let layout: LayoutItem;

    let filter: RangeFilterStore | OptionsFilterStore | StringFilterStore | PF2_Level_RangeFilterStore | PF2_TraitFilterStore | PF2_Monster_TypeFilterStore;
    $: {
        if (!("nested" in layout)) {
            filter = $filters.get(layout.id);
        }
    }
</script>

{#if "nested" in layout}
    <div class="nested-filter-container">
        {#each layout.nested as nested}
            <svelte:self layout={nested} />
        {/each}
    </div>
{:else}
    <div class="filter-container">
        {#if filter.type == FilterType.Range}
            <Range {filter} />
        {/if}
        {#if filter.type == FilterType.PF2_Level_Range}
            <Range {filter} />
        {/if}
        {#if filter.type == FilterType.Options}
            <Options {filter} />
        {/if}
        {#if filter.type == FilterType.Search}
            <Search {filter} />
        {/if}
        {#if filter.type == FilterType.PF2_Trait}
            <Search {filter} />
        {/if}
        {#if filter.type == FilterType.PF2_Monster_Type}
            <Search {filter} />
        {/if}
    </div>
{/if}

<style scoped>
    :global(.nested-filter-container) {
        display: flex;
        flex-flow: row wrap;
        gap: 0.5rem;
    }
    .filter-container {
        flex-grow: 1;
        flex-basis: 0;
    }
</style>
