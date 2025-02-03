<script lang="ts">
    import type { PF2_Level_RangeFilterStore, RangeFilterStore } from "src/builder/stores/filter/filter";
    import Slider from "./Slider.svelte";

    export let filter: RangeFilterStore|PF2_Level_RangeFilterStore;
    $: min = `Min ${filter.filter.text}`;
    $: max = `Max ${filter.filter.text}`;
</script>

<div class="range-filter">
    <span>{min}</span>
    <input
        type="number"
        placeholder={min}
        min={filter.options[0]}
        max={filter.options[1]}
        bind:value={$filter[0]}
    />
    <Slider
        bind:value={$filter}
        range
        order
        min={filter.options[0]}
        max={filter.options[1]}
    />
    <input
        type="number"
        placeholder={max}
        min={filter.options[0]}
        max={filter.options[1]}
        bind:value={$filter[1]}
    />
    <span>{max}</span>
</div>

<style scoped>
    .range-filter {
        display: flex;
        align-items: center;
        gap: 1rem;
        width: 100%;
        white-space: nowrap;
    }
</style>
