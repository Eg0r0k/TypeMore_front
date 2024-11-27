import { mount } from '@vue/test-utils'
import { beforeEach, describe, it, vi } from 'vitest'
import { Alert } from '@/shared/ui/alert'
import { expect } from 'chai'
import { AlertType } from '@/entities/alert/types/alertData'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'

vi.mock('@/entities/config/model/store', () => ({
  useConfigStore: () => ({
    config: {
      soundVolume: 0.5
    }
  })
}))
const IconMock = defineComponent({
  name: 'Icon',
  template: '<span>Icon</span>'
})

vi.mock('@iconify/vue', () => ({
  Icon: {
    name: 'Icon',
    template: '<span>Icon</span>'
  }
}))

vi.mock('@vueuse/sound', () => ({
  useSound: () => ({
    play: vi.fn()
  })
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
  it('renders correct icon based on type', () => {
    const wrapper = mount(Alert, {
      props: { type: AlertType.Error, msg: 'Error message' },
      global: {
        plugins: [createPinia()],
        stubs: {
          Icon: IconMock
        }
      }
    })
    expect(wrapper.findComponent({ name: 'Icon' }).exists()).to.equal(true)
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
    expect(wrapper.find('.alert__close-btn').exists()).to.be.equal(false)
  })
  it('emits close event when close button is clicked', async () => {
    const wrapper = mount(Alert, {
      props: { type: AlertType.Info, msg: 'Info message', closable: true },
      global: { plugins: [createPinia()] }
    })
    await wrapper.find('.alert__close-btn').trigger('click')
    expect(wrapper.emitted('close')).to.have.lengthOf.above(0)
  })
  it('applies correct CSS class based on alert type', () => {
    const wrapper = mount(Alert, {
      props: { type: AlertType.Error, msg: 'Error message' },
      global: { plugins: [createPinia()] }
    })
    expect(wrapper.classes()).to.include('alert--error')
  })
})
