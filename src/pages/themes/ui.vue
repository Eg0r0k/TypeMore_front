<template>
  <div>
    <div class="settings">
      <TextInput class="settings__search" placeholder="Search..." />
      <div class="settings__categories">
        <CheckBox v-model="isFeatureAEnabled" label="Enable Feature A" value="Test" />
        <CheckBox v-model="isFeatureAEnabled" label="Enable Feature A" value="Test" />
        <CheckBox v-model="isFeatureAEnabled" label="Enable Feature A" value="Test" />
      </div>
      <vue-slider v-model="value" height="6px" :lazy="true"></vue-slider>
    </div>
    <div class="container">
      <div v-for="i in 10" :key="i" class="card">
        <Splide :has-track="false" :options="{ rewind: true }">
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
  import { TextInput } from '@/shared/ui/input'
  import slide1 from './slide1.vue'
  import slide2 from './slide2.vue'
  import { ref } from 'vue'
  const isFeatureAEnabled = ref(false)

  const value = ref([0, 100])
</script>

<style scoped lang="scss">
  .settings {
    width: 100%;
    margin-bottom: 20px;
    background-color: var(--sub-alt-color);
    padding: 33px 38px;
    border-radius: var(--border-radius);
    &__categories {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
    }
  }

  .container {
    display: grid;
    gap: 21px;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  }

  .apply {
    width: 100%;
  }

  .card {
    display: flex;
    flex-direction: column;
    background-color: var(--sub-alt-color);
    border-radius: var(--border-radius);
    overflow: hidden;

    &__footer {
      padding: 10px 24px 24px 24px;
    }

    &__controls {
      display: flex;
      gap: 15px;
    }

    &__desc {
      margin-bottom: 24px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
  }
</style>
