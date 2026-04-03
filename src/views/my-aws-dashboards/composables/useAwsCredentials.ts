import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'
import type { AwsCredentials } from '../types'

const STORAGE_KEY = 'my-aws-dashboard:credentials'

const DEFAULT_CREDENTIALS: AwsCredentials = {
  accountId: '',
  accessKeyId: '',
  secretAccessKey: '',
  sessionToken: '',
  region: 'us-east-1',
}

export function useAwsCredentials() {
  const stored = useLocalStorage<AwsCredentials>(STORAGE_KEY, DEFAULT_CREDENTIALS)

  const hasCredentials = computed(
    () =>
      stored.value.accessKeyId.trim().length > 0 && stored.value.secretAccessKey.trim().length > 0,
  )

  function saveCredentials(creds: AwsCredentials): void {
    stored.value = { ...creds }
  }

  function clearCredentials(): void {
    stored.value = { ...DEFAULT_CREDENTIALS }
  }

  return {
    credentials: stored,
    hasCredentials,
    saveCredentials,
    clearCredentials,
  }
}
