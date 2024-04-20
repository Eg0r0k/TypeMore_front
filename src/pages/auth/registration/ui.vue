<template>

    <Container class="wrapper">
        <div class="registration">
            <div class="registration__header">
                <Typography color="main" tag-name="h2" size="xl" class="registration__title">Registration</Typography>
                <Typography color="primary" size="m">Fill in all fields to register</Typography>
            </div>
            <form action="" class="registration__body" autocomplete="off">
                <TextInput :placeholder="'Username'" />
                <TextInput :placeholder="'Email'" />
                <TextInput :placeholder="'Password'" />
                <Popper arrow class="registration__popper" content="Wellcome to us team">
                    <Button @click.prevent="" type="sumbit" class="registration__sumbit">asdd</Button>
                </Popper>
            </form>
            <div class="registration__footer">
                <Typography tag-name="p" color="primary">No accaut?
                    <router-link to="/login" class="registration__link">Create</router-link>
                </Typography>
            </div>
        </div>
    </Container>

</template>

<script setup lang="ts">
import { Header } from '@/widgets/header';
import { Container } from '@/shared/ui/container';
import { Typography } from '@/shared/ui/typography';
import { TextInput } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { defineComponent } from "vue";
import Popper from "vue3-popper";

</script>

<style scoped lang="scss">
.wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
}



.registration {
    padding: 32px;
    background-color: var(--sub-alt-color);
    border-radius: var(--border-radius);
    max-width: 295px;
    width: 100%;

    &__link {
        color: var(--main-color);

        &:visited {
            color: var(--main-color)
        }
    }

    &__header {
        text-align: center;
    }

    &__title {
        margin-bottom: 8px;
    }

    &:deep(.popper) {
        font-size: 18px;
    }

    &__popper,
    &__sumbit {
        width: 100%;
    }
}
</style>