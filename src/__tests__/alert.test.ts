import { mount } from '@vue/test-utils'
import { beforeEach, describe, it, vi, expect } from 'vitest'
import { Alert } from '@/shared/ui/alert'
import { AlertType } from '@/entities/alert/types/alertData'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/entities/config/model/store', () => ({
  useConfigStore: () => ({
    config: {
      soundVolume: 0.5
    }
  })
}))

vi.mock('@vueuse/sound', () => ({
  useSound: () => ({
    play: vi.fn()
  })
}))

// Stub the per-type icon components so we can assert the correct one renders
// without depending on the real SVG markup.
vi.mock('~icons/tabler/alert-circle', () => ({
  default: { name: 'IconAlertCircle', template: '<svg data-icon="alert-circle" />' }
}))
vi.mock('~icons/tabler/info-circle', () => ({
  default: { name: 'IconInfoCircle', template: '<svg data-icon="info-circle" />' }
}))
vi.mock('~icons/tabler/circle-check', () => ({
  default: { name: 'IconCircleCheck', template: '<svg data-icon="circle-check" />' }
}))
vi.mock('~icons/tabler/alert-triangle', () => ({
  default: { name: 'IconAlertTriangle', template: '<svg data-icon="alert-triangle" />' }
}))
vi.mock('~icons/tabler/x', () => ({
  default: { name: 'IconX', template: '<svg data-icon="x" />' }
}))

describe('Alert', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders message correctly', () => {
    const msg = 'Test message'
    const wrapper = mount(Alert, {
      props: { type: AlertType.Info, msg },
      global: { plugins: [createPinia()] }
    })
    expect(wrapper.text()).contain(msg)
  })

  it('exposes the alert role', () => {
    const wrapper = mount(Alert, {
      props: { type: AlertType.Info, msg: 'Info message' },
      global: { plugins: [createPinia()] }
    })
    expect(wrapper.find('[role="alertdialog"]').exists()).to.equal(true)
  })

  it('renders the mapped icon for each type', () => {
    const cases: Array<[AlertType, string]> = [
      [AlertType.Error, 'alert-circle'],
      [AlertType.Info, 'info-circle'],
      [AlertType.Success, 'circle-check'],
      [AlertType.Warning, 'alert-triangle']
    ]
    for (const [type, icon] of cases) {
      const wrapper = mount(Alert, {
        props: { type, msg: 'message' },
        global: { plugins: [createPinia()] }
      })
      expect(wrapper.find(`[data-icon="${icon}"]`).exists(), icon).to.equal(true)
      // No other type's icon leaks in (the close-button icon is excluded here).
      const others = ['alert-circle', 'info-circle', 'circle-check', 'alert-triangle'].filter(
        (i) => i !== icon
      )
      for (const o of others) {
        expect(wrapper.find(`[data-icon="${o}"]`).exists(), o).to.equal(false)
      }
    }
  })

  it('renders title correctly', () => {
    const title = 'Custom Title'
    const wrapper = mount(Alert, {
      props: { type: AlertType.Success, msg: 'Success message', title },
      global: { plugins: [createPinia()] }
    })
    expect(wrapper.text()).contain(title)
  })

  it('renders default title when no title is provided', () => {
    const wrapper = mount(Alert, {
      props: { type: AlertType.Warning, msg: 'Warning message' },
      global: { plugins: [createPinia()] }
    })
    expect(wrapper.text()).contain('Warning')
  })

  it('does not render close button when closable is false', () => {
    const wrapper = mount(Alert, {
      props: { type: AlertType.Info, msg: 'Info message', closable: false },
      global: { plugins: [createPinia()] }
    })
    expect(wrapper.find('[aria-label="Close alert"]').exists()).to.equal(false)
  })

  it('emits close event when close button is clicked', async () => {
    const wrapper = mount(Alert, {
      props: { type: AlertType.Info, msg: 'Info message', closable: true },
      global: { plugins: [createPinia()] }
    })
    const closeBtn = wrapper.find('[aria-label="Close alert"]')
    expect(closeBtn.exists()).to.equal(true)
    await closeBtn.trigger('click')
    expect(wrapper.emitted('close')).to.have.lengthOf.above(0)
  })
})
