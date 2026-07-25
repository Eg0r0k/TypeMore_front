import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { BackgroundImage } from '@/features/home/background'
import { setConfig } from '@/shared/lib/helpers/config'

const REMOTE = 'https://example.com/pic.png'
const LOCAL = 'data:image/png;base64,iVBORw0KGgo='

const mountBg = () => mount(BackgroundImage, { global: { plugins: [createPinia()] } })

const clear = () => {
  setConfig('backgroundImg', '')
  setConfig('backgroundLocal', '')
  setConfig('backgroundSize', 'cover')
}

describe('BackgroundImage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    clear()
  })
  afterEach(clear)

  it('renders nothing while both sources are empty', () => {
    expect(mountBg().find('img').exists()).toBe(false)
  })

  it('renders the remote URL when only it is set', () => {
    setConfig('backgroundImg', REMOTE)
    expect(mountBg().get('img').attributes('src')).toBe(REMOTE)
  })

  it('lets the local data URL win over the remote one', () => {
    setConfig('backgroundImg', REMOTE)
    setConfig('backgroundLocal', LOCAL)
    expect(mountBg().get('img').attributes('src')).toBe(LOCAL)
  })

  it('maps every fit mode onto object-fit', () => {
    setConfig('backgroundLocal', LOCAL)

    setConfig('backgroundSize', 'cover')
    expect(mountBg().get('img').attributes('style')).toContain('object-fit: cover')

    setConfig('backgroundSize', 'contain')
    expect(mountBg().get('img').attributes('style')).toContain('object-fit: contain')

    // `max` stretches corner to corner.
    setConfig('backgroundSize', 'max')
    expect(mountBg().get('img').attributes('style')).toContain('object-fit: fill')
  })

  it('drops the layer when the image fails to load, and retries on a new source', async () => {
    setConfig('backgroundImg', REMOTE)
    const wrapper = mountBg()

    await wrapper.get('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)

    setConfig('backgroundLocal', LOCAL)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('img').attributes('src')).toBe(LOCAL)
  })
})
