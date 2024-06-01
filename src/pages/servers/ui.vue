<template>
    <div class="test-color">
        <div class="test-color__container">
            <Typography color="primary" size="xl" tagName="p">
                The
                <Typography color="error" tagName="span" decoration="underline" size="xl">quick</Typography>
                <Typography size="xl" tagName="span" color="sub"> brown </Typography>
                <Typography tagName="span" color="extra-error" decoration="underline" size="xl">fox jumps
                </Typography>
                <Typography tagName="span" color="main" size="xl"> over the lazy</Typography>
                dog
            </Typography>
            <div class="test">
                <Popper hover arrow offset-distance="6" :content="'some information'">
                    <Button class="test__btn" color="gray">Button with hint</Button>
                </Popper>
                <Button class="test__btn" color="main">
                    <template #left-icon>
                        <Icon width="24" icon="fluent:target-20-filled" />
                    </template>
                    Text
                </Button>
                <TextInput placeholder="Some text" />
            </div>

        </div>

        <div class="controls">
            <div class="theme-input" v-for="(color, index) in colors" :key="index">
                <Typography style="flex: 1" size="m" color="primary">{{ color.label }}</Typography>
                <TextInput v-model="color.hex" />
                <div class="color">
                    <Icon icon="mdi:color" width="30" />
                    <input class="input-color" type="color" v-model="color.hex" />
                </div>
            </div>
            <div></div>
            <Button @click="copyTheme">
                <template #left-icon>
                    <Icon width="24" icon="ph:copy-bold" />
                </template>
                copy Theme</Button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { TextInput } from '@/shared/ui/input';
import { Typography } from '@shared/ui/typography';
import { Button } from '@shared/ui/button';
import { ref, watch } from 'vue';
const root: HTMLElement | null = document.querySelector(':root');


const colors = ref([
    { label: 'background', var: '--bg-color', hex: '#111111' },
    { label: 'main', var: '--main-color', hex: '#f7f7f7' },
    { label: 'sub-color', var: '--sub-color', hex: '#444444' },
    { label: 'sub-alt-color', var: '--sub-alt-color', hex: '#191919' },
    { label: 'text-color', var: '--text-color', hex: '#eeeeee' },
    { label: 'error', var: '--error-color', hex: '#da3333' },
    { label: 'extra-error', var: '--error-extra-color', hex: '#791717' },
]);
type Theme = {
    name: string;
    '--bg-color': string;
    '--main-color': string;
    '--sub-color': string;
    '--sub-alt-color': string;
    '--text-color': string;
    '--error-color': string;
    '--error-extra-color': string;
};
interface Color {
    label: string;
    var: string;
    hex: string;
}
const setVariables = (themeColors: Color[]): void => {
    if (root) {
        themeColors.forEach(color => {
            root.style.setProperty(color.var, color.hex);
        });
    }
};
const getTheme = (): Theme => {

    const theme: Theme = {
        'name': 'custom',
        '--bg-color': '',
        '--main-color': '',
        '--sub-color': '',
        '--sub-alt-color': '',
        '--text-color': '',
        '--error-color': '',
        '--error-extra-color': '',
    };
    colors.value.forEach(color => {
        if (Object.prototype.hasOwnProperty.call(theme, color.var)) {
            (theme as any)[color.var] = color.hex;
        }
    })


    return theme;
}

watch(colors, (newVal) => {
    setVariables(newVal)
}, { deep: true })

const copyTheme = async () => {
    const theme = getTheme()
    try {
        await navigator.clipboard.writeText(JSON.stringify(theme, null, 2))
    }
    catch (error) {
        console.log('Faild to copy', error)
    }
}

</script>

<style lang="scss" scoped>
.controls {
    border-top: 2px solid var(--sub-alt-color);
    padding-top: 40px;
    display: grid;
    width: 100%;
    column-gap: 50px;
    row-gap: 20px;
    grid-template-columns: repeat(1, 1fr);

    @media (min-width: 792px) {
        grid-template-columns: repeat(2, 1fr);
    }
}

.theme-input {
    display: flex;
    align-items: center;
    gap: 10px;
}

.color {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 40px;
    min-width: 40px;
    background-color: var(--sub-alt-color);
    border-radius: var(--border-radius);
    cursor: pointer;
    user-select: none;

    & input {
        position: absolute;


        opacity: 0;
        cursor: pointer;
        height: 100%;
        width: 100%;
    }
}

.test {
    display: flex;
    flex-direction: column;
    gap: 12px;

    &__btn {
        width: 100%;
    }
}

.test-color {
    display: flex;
    flex-direction: column;
    gap: 40px;

    &__container {
        display: grid;
        width: 100%;
        gap: 12px;
        grid-template-columns: repeat(1, 1fr);

        @media (min-width: 792px) {
            grid-template-columns: repeat(2, 1fr);
        }
    }
}
</style>