/** Recount after typing settles; cancel a pending recount when the editor closes. */
export function debounceCount(callback: () => void, delay = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    schedule() {
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => { timer = undefined; callback() }, delay)
    },
    cancel() {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
    },
  }
}
