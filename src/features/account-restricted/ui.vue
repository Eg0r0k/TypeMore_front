<template>
  <p v-if="restricted" class="account-restricted" data-testid="account-restricted">
    {{ t('auth.header.restricted') }}
  </p>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'

  import { useCurrentUser } from '@/entities/auth'

  /**
   * A quiet, persistent line shown while the account is under a restriction.
   *
   * It says one thing and offers nothing: no reason, no expiry, no appeal
   * button. That is the product decision, not a placeholder — the server keeps
   * the moderation note internal and `/me` carries a bare boolean, so there is
   * literally nothing else to render (backend `docs/MODERATION.md`).
   *
   * Informational rather than alarming: the design-system sub colour, no icon,
   * no border. A restricted player can still log in, still play, and still read
   * boards; the only thing that changed is that their runs stop counting, and a
   * red alarm would misdescribe that.
   */
  const { t } = useI18n()
  // Shares the bootstrap's `/me` query rather than issuing one: the flag is a
  // field of the session that is already loaded, not a second thing to fetch.
  const { data: user } = useCurrentUser()

  const restricted = computed(() => user.value?.restricted === true)
</script>

<style lang="scss" scoped>
  .account-restricted {
    font-size: 13px;
    line-height: 1;
    color: var(--sub-color);
  }
</style>
