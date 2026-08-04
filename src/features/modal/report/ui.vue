<template>
  <Dialog v-model:open="open">
    <DialogContent class="gap-3 sm:max-w-[400px]">
      <DialogTitle as-child>
        <Typography class="report-modal__title" size="l" tag-name="h2" color="primary">
          {{ t(`report.title.${subject.type}`) }}
        </Typography>
      </DialogTitle>
      <!-- Who or what is being reported, so a modal opened from a dense table
           row can never be about the wrong line. sr-only fallback keeps the
           dialog described even when the caller has no label to give. -->
      <DialogDescription :class="subjectLabel ? undefined : 'sr-only'">
        <Typography size="s" color="sub">
          {{ subjectLabel ?? t(`report.title.${subject.type}`) }}
        </Typography>
      </DialogDescription>

      <!-- Both controls are named by `aria-label`; the a11y rule cannot see
           what a component renders, so it reads them as unlabelled. -->
      <Select v-model="reason">
        <SelectTrigger
          class="w-full"
          :aria-label="t('report.reasonLabel')"
          data-testid="report-reason"
        >
          <SelectValue :placeholder="t('report.reasonPlaceholder')" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="code in reasons" :key="code" :value="code">
            {{ t(`report.reasons.${code}`) }}
          </SelectItem>
        </SelectContent>
      </Select>

      <TextInput
        v-model="comment"
        tag-name="textarea"
        rows="3"
        :maxlength="REPORT_COMMENT_MAX"
        :aria-label="t('report.commentPlaceholder')"
        :placeholder="t('report.commentPlaceholder')"
        data-testid="report-comment"
      />

      <Typography v-if="errorText" color="error" size="xs" data-testid="report-error">
        {{ errorText }}
      </Typography>

      <Button
        size="m"
        color="main-outline"
        :disabled="reason === '' || mutation.isPending.value"
        data-testid="report-submit"
        @click="submit"
      >
        {{ t('report.submit') }}
      </Button>
    </DialogContent>
  </Dialog>
</template>

<script lang="ts" setup>
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
  import { Button } from '@/shared/ui/button'
  import { TextInput } from '@/shared/ui/input'
  import { Typography } from '@/shared/ui/typography'
  import { toast } from '@/shared/ui/sonner'
  import {
    REPORT_COMMENT_MAX,
    REPORT_REASONS,
    isApiError,
    useFileReportMutation,
    type ReportReason,
    type ReportSubject
  } from '@shared/api'

  /**
   * One modal for all three report subjects (backend `docs/REPORTS.md`): the
   * caller says WHAT is being reported, this modal owns the rest. The reason
   * list is the subject type's own vocabulary — the server refuses a reason
   * that does not apply, so one is never offered.
   *
   * A repeat report answers 200 with the already-open report and this modal
   * deliberately shows the same "sent" confirmation: the player expressed a
   * state that already holds, and the server's whole point in not answering
   * 409 is that they should not have to read an error to learn "yes, we know".
   */
  const props = defineProps<{
    subject: ReportSubject
    /** Human name of the subject — a display name, a quote attribution. */
    subjectLabel?: string
  }>()

  const open = defineModel<boolean>('open', { required: true })
  const { t } = useI18n()

  const reasons = computed(() => REPORT_REASONS[props.subject.type])

  const reason = ref<ReportReason | ''>('')
  const comment = ref('')
  const mutation = useFileReportMutation()

  // A fresh open is a fresh report: nothing typed for a previous subject may
  // survive into this one.
  watch(open, (isOpen) => {
    if (!isOpen) return
    reason.value = ''
    comment.value = ''
    mutation.reset()
  })

  const errorText = computed(() => {
    const err = mutation.error.value
    if (!err) return null
    if (isApiError(err)) {
      if (err.code === 'unauthorized') return t('report.errors.signIn')
      if (err.code === 'restricted') return t('report.errors.restricted')
      if (err.code === 'rate_limited' || err.code === 'too_many_open_reports')
        return t('report.errors.tooMany')
      if (err.code === 'not_found') return t('report.errors.notFound')
    }
    return t('report.errors.generic')
  })

  const submit = () => {
    if (reason.value === '') return
    const trimmed = comment.value.trim()
    mutation.mutate(
      {
        subject: props.subject,
        reason: reason.value,
        ...(trimmed === '' ? {} : { comment: trimmed })
      },
      {
        onSuccess: () => {
          toast.success(t('report.sent'))
          open.value = false
        }
      }
    )
  }
</script>

<style lang="scss" scoped>
  .report-modal {
    &__title {
      margin-bottom: 4px;
    }
  }
</style>
