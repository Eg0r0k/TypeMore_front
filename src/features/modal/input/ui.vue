<template>
    <div class="input-modal">
        <Typography color="primary" size="l">
            Custom word amount
        </Typography>
        <TextInput placeholder="Some text" />
        <Typography color="primary" size="xs">
            You can start an infinite test by inputting 0. Then, to stop the test, use the Bail Out feature
        </Typography>
        <Button size="m" color="gray">
            ok
        </Button>
    </div>
</template>

<script setup lang="ts">
import { TextInput } from '@/shared/ui/input';
import { Typography } from '@/shared/ui/typography';
import { Button } from '@/shared/ui/button';
</script>

<style lang="scss" scoped>
.input-modal {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 500px;
    background: var(--bg-color);
    border-radius: var(--border-radius);
    padding: 24px;
    width: 100%;
    box-shadow: 0 0 0 .2em var(--sub-alt-color);
}
</style>