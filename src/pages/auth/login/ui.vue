<template>
    <div class="login__wrapper">
        <div class="login">
            <div class="login__header">
                <Typography color="main" tag-name="h2" size="xl" class="login__title">Login</Typography>
                <Typography color="primary" size="m">Fill in all fields to login</Typography>
            </div>
            <form action="" class="login__body" autocomplete="off">
                <TextInput is-required :placeholder="'Email'" />
                <TextInput :type="'password'" is-required :placeholder="'Password'" />
                <Button @click.prevent="" type="sumbit" class="login__sumbit">Login</Button>
            </form>

            <div class="divider">
                <Typography color="main">or</Typography>
            </div>
            <div class="other login__other">
                <Button color="gray" class="other__button other__button--google">
                    <template #left-icon>
                        <Icon width="24" icon="ri:google-fill"></Icon>
                    </template>
                    Google
                </Button>
                <Button color="gray" class="other__button other__button--github">
                    <template #left-icon>
                        <Icon width="24" icon="mdi:github"></Icon>
                    </template>
                    GitHub
                </Button>
            </div>
            <div class="login__footer">
                <Typography tag-name="p" color="primary">No accaut?
                    <router-link to="/registration" class="login__link">Create</router-link>
                </Typography>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { Typography } from '@shared/ui/typography'
import { TextInput } from '@shared/ui/input'
import { Button } from '@shared/ui/button'
</script>

<style scoped lang="scss">
.other {
    display: flex;
    flex-direction: column;
    gap: 12px;

    &__button {
        width: 100%;
    }
}

.divider {
    display: flex;
    position: relative;
    justify-content: center;
}

.login {
    width: 100%;
    max-width: 295px;
    display: flex;
    flex-direction: column;
    padding: 32px;
    border: 2px solid var(--sub-alt-color);
    border-radius: var(--border-radius);
    gap: 24px;

    &__header {
        text-align: center;

    }

    &__body {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }


    &__footer {}

    &__title {
        margin-bottom: 8px;
    }

    &__sumbit {
        width: 100%;
    }

    &__wrapper {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
    }
}
</style>
