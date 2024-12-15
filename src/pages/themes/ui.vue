<template>
  <div>
    <div class="options">
      <SearchBar class="options__search" v-model="query" />
      <div class="settings">
        <div class="settings__slider">
          <Icon width="24" icon="stash:moon-solid" />
          <vue-slider class="slider" v-model="value" :lazy="true"></vue-slider>
          <Icon width="24" icon="stash:sun-solid" />
        </div>
        <div class="devider devider--vert"></div>

        <div class="settings__group">
          <CheckBox v-model="hasBackground">
            <Icon width="24" icon="uil:image" />
          </CheckBox>
          <CheckBox v-model="withoutBackground">
            <Icon width="24" icon="uil:image-slash" />
          </CheckBox>
          <div class="devider"></div>
          <Popper
            placement="top"
            offset-distance="2"
            content="Only favorite"
            hover
            arrow
            :interactive="false"
          >
            <ToggleButton
              class="settings__favorite"
              v-model="isFavorite"
              toggled-color="error-outline"
              color="shadow"
            >
              <template #left-icon>
                <Icon icon="ic:baseline-favorite" />
              </template>
            </ToggleButton>
          </Popper>
        </div>
      </div>
    </div>

    <div class="container">
      <div v-for="i in 10" :key="i" class="card">
        <Splide lazyLoad="" :has-track="false" :options="{ rewind: true }">
          <div class="sweeper-wrapper">
            <SplideTrack>
              <SplideSlide>
                <slide1 />
              </SplideSlide>
              <SplideSlide>
                <slide2 />
              </SplideSlide>
            </SplideTrack>
          </div>
        </Splide>
        <div class="card__footer">
          <div class="card__desc">
            <Typography tag="p" color="sub">
              Uploaded by
              <Typography decoration="underline" tag-name="span">nalyd_vs</Typography>
            </Typography>
            <Typography tag="h2" color="primary" size="l" decoration="underline">Soyjak</Typography>
            <Typography tag="p" color="primary" size="s">No description provided.</Typography>
          </div>
          <div class="card__controls">
            <Button size="m" color="error-outline">
              <template #left-icon>
                <Icon width="16" icon="material-symbols:favorite-outline" />
              </template>
              32
            </Button>
            <Button color="main-outline" class="apply" size="m">
              <template #left-icon>
                <Icon width="18" icon="mingcute:paint-2-fill" />
              </template>
              Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { CheckBox } from '@/shared/ui/checkbox'
  import { Splide, SplideSlide, SplideTrack } from '@splidejs/vue-splide'
  import VueSlider from 'vue-slider-component'
  import 'vue-slider-component/theme/default.css'
  import { Icon } from '@iconify/vue'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'
  import slide1 from './slide1.vue'
  import slide2 from './slide2.vue'
  import { ref } from 'vue'
  import { SearchBar } from '@/shared/ui/search'

  import { ToggleButton } from '@/shared/ui/toggleButton'
  const hasBackground = ref(false)
  const withoutBackground = ref(false)
  const isFavorite = ref(false)
  const value = ref([0, 100])
  const query = ref('')
</script>

<style scoped lang="scss">
  .options {
    &__search {
      margin: 0 0 0.5rem;
    }
  }

  .settings {
    display: flex;
    gap: 1rem;
    width: 100%;
    padding: 1rem;
    margin-bottom: 20px;
    background-color: var(--sub-alt-color);
    border-radius: var(--border-radius);

    &__slider {
      display: flex;
      align-items: center;
      flex-grow: 1;
      gap: 1rem;
    }

    &__group {
      display: flex;
      flex-direction: row;
      justify-content: space-around;
      flex-grow: 1;
    }

    &__favorite {
      width: 30px;
      height: 30px;
    }

    &__categories {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
    }
  }

  .slider {
    flex-grow: 1;
  }

  .devider {
    display: flex;
    flex-direction: row;
    align-items: center;
    background-color: var(--sub-color);
    align-self: stretch;
    width: 1px;
    margin: 0 1rem;
    white-space: nowrap;
  }

  .container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(252px, 1fr));
    gap: 21px;
  }

  .apply {
    width: 100%;
  }

  .card {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: var(--sub-alt-color);
    border-radius: var(--border-radius);

    &__footer {
      padding: 10px 24px 24px;
    }

    &__controls {
      display: flex;
      gap: 15px;
    }

    &__desc {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 24px;
    }
  }

  @media screen and (width <=539px) {
    .settings {
      flex-direction: column;
    }

    .card {
      &__controls {
        flex-direction: column;
        gap: 10px;
      }
    }

    .devider {
      &--vert {
        width: 100% !important;
        height: 1px;
        margin-right: 0 !important;
        margin-left: 0 !important;
      }
    }
  }
</style>
