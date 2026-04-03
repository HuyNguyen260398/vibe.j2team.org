<script setup lang="ts">
import { ref, reactive } from 'vue'
import { Icon } from '@iconify/vue'
import type { AwsCredentials } from '../types'
import { AWS_REGIONS } from '../utils/demoData'

const emit = defineEmits<{
  connect: [credentials: AwsCredentials]
  demo: []
}>()

const form = reactive<AwsCredentials>({
  accountId: '',
  accessKeyId: '',
  secretAccessKey: '',
  sessionToken: '',
  region: 'us-east-1',
})

const showSecret = ref(false)
const showAdvanced = ref(false)
const errors = reactive({ accountId: '', accessKeyId: '', secretAccessKey: '' })

function validateAccountId(value: string): string {
  if (!value.trim()) return 'Account ID is required'
  if (!/^\d{12}$/.test(value.trim())) return 'Must be a 12-digit numeric AWS Account ID'
  return ''
}

function validateAccessKeyId(value: string): string {
  if (!value.trim()) return 'Access Key ID is required'
  if (!/^[A-Z0-9]{16,128}$/.test(value.trim()))
    return 'Must be 16–128 uppercase alphanumeric characters'
  return ''
}

function validateSecretKey(value: string): string {
  if (!value.trim()) return 'Secret Access Key is required'
  if (value.trim().length < 40) return 'Secret Access Key must be at least 40 characters'
  return ''
}

function handleSubmit(): void {
  errors.accountId = validateAccountId(form.accountId)
  errors.accessKeyId = validateAccessKeyId(form.accessKeyId)
  errors.secretAccessKey = validateSecretKey(form.secretAccessKey)
  if (errors.accountId || errors.accessKeyId || errors.secretAccessKey) return
  emit('connect', { ...form })
}

function handleDemo(): void {
  emit('demo')
}

function toggleShowSecret(): void {
  showSecret.value = !showSecret.value
}

function toggleAdvanced(): void {
  showAdvanced.value = !showAdvanced.value
}
</script>

<template>
  <div class="flex min-h-[60vh] items-center justify-center px-4 py-12">
    <div class="w-full max-w-md animate-fade-up">
      <!-- Header -->
      <div class="mb-8 text-center">
        <div class="mb-4 flex justify-center">
          <div
            class="flex size-16 items-center justify-center border border-accent-coral bg-bg-surface"
          >
            <Icon icon="lucide:cloud" class="size-8 text-accent-coral" />
          </div>
        </div>
        <h1 class="font-display text-2xl font-bold text-text-primary">
          Connect to
          <span class="text-accent-amber">AWS</span>
        </h1>
        <p class="mt-2 text-sm text-text-secondary">
          Enter your AWS credentials to view real cost and billing data.
        </p>
      </div>

      <!-- Auth Form -->
      <div class="border border-border-default bg-bg-surface p-6">
        <form @submit.prevent="handleSubmit">
          <!-- Account ID -->
          <div class="mb-4">
            <label
              for="accountId"
              class="mb-1.5 flex items-center gap-1.5 font-display text-xs tracking-wide text-text-secondary"
            >
              <Icon icon="lucide:hash" class="size-3.5" />
              ACCOUNT ID
              <span class="text-accent-coral">*</span>
            </label>
            <input
              id="accountId"
              v-model="form.accountId"
              type="text"
              autocomplete="off"
              spellcheck="false"
              inputmode="numeric"
              maxlength="12"
              placeholder="123456789012"
              class="w-full border border-border-default bg-bg-deep px-3 py-2.5 font-mono text-sm text-text-primary placeholder:text-text-dim focus:border-accent-coral focus:outline-none"
              :class="{ 'border-red-500': errors.accountId }"
              @blur="errors.accountId = validateAccountId(form.accountId)"
            />
            <p v-if="errors.accountId" class="mt-1 text-xs text-red-400">
              {{ errors.accountId }}
            </p>
          </div>

          <!-- Access Key ID -->
          <div class="mb-4">
            <label
              for="accessKeyId"
              class="mb-1.5 flex items-center gap-1.5 font-display text-xs tracking-wide text-text-secondary"
            >
              <Icon icon="lucide:key" class="size-3.5" />
              ACCESS KEY ID
              <span class="text-accent-coral">*</span>
            </label>
            <input
              id="accessKeyId"
              v-model="form.accessKeyId"
              type="text"
              autocomplete="off"
              spellcheck="false"
              placeholder="AKIAIOSFODNN7EXAMPLE"
              class="w-full border border-border-default bg-bg-deep px-3 py-2.5 font-mono text-sm text-text-primary placeholder:text-text-dim focus:border-accent-coral focus:outline-none"
              :class="{ 'border-red-500': errors.accessKeyId }"
              @blur="errors.accessKeyId = validateAccessKeyId(form.accessKeyId)"
            />
            <p v-if="errors.accessKeyId" class="mt-1 text-xs text-red-400">
              {{ errors.accessKeyId }}
            </p>
          </div>

          <!-- Secret Access Key -->
          <div class="mb-4">
            <label
              for="secretKey"
              class="mb-1.5 flex items-center gap-1.5 font-display text-xs tracking-wide text-text-secondary"
            >
              <Icon icon="lucide:lock" class="size-3.5" />
              SECRET ACCESS KEY
              <span class="text-accent-coral">*</span>
            </label>
            <div class="relative">
              <input
                id="secretKey"
                v-model="form.secretAccessKey"
                :type="showSecret ? 'text' : 'password'"
                autocomplete="current-password"
                spellcheck="false"
                placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                class="w-full border border-border-default bg-bg-deep py-2.5 pl-3 pr-10 font-mono text-sm text-text-primary placeholder:text-text-dim focus:border-accent-coral focus:outline-none"
                :class="{ 'border-red-500': errors.secretAccessKey }"
                @blur="errors.secretAccessKey = validateSecretKey(form.secretAccessKey)"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-secondary"
                :aria-label="showSecret ? 'Hide secret key' : 'Show secret key'"
                @click="toggleShowSecret"
              >
                <Icon :icon="showSecret ? 'lucide:eye-off' : 'lucide:eye'" class="size-4" />
              </button>
            </div>
            <p v-if="errors.secretAccessKey" class="mt-1 text-xs text-red-400">
              {{ errors.secretAccessKey }}
            </p>
          </div>

          <!-- Region -->
          <div class="mb-4">
            <label
              for="region"
              class="mb-1.5 flex items-center gap-1.5 font-display text-xs tracking-wide text-text-secondary"
            >
              <Icon icon="lucide:globe" class="size-3.5" />
              REGION
            </label>
            <select
              id="region"
              v-model="form.region"
              class="w-full border border-border-default bg-bg-deep px-3 py-2.5 text-sm text-text-primary focus:border-accent-coral focus:outline-none"
            >
              <option v-for="r in AWS_REGIONS" :key="r.value" :value="r.value">
                {{ r.label }}
              </option>
            </select>
          </div>

          <!-- Advanced: Session Token -->
          <div class="mb-6">
            <button
              type="button"
              class="flex items-center gap-1.5 text-xs text-text-dim hover:text-text-secondary"
              @click="toggleAdvanced"
            >
              <Icon
                icon="lucide:chevron-right"
                class="size-3.5 transition-transform duration-200"
                :class="{ 'rotate-90': showAdvanced }"
              />
              Advanced (Session Token)
            </button>
            <div v-if="showAdvanced" class="mt-3">
              <label
                for="sessionToken"
                class="mb-1.5 flex items-center gap-1.5 font-display text-xs tracking-wide text-text-secondary"
              >
                <Icon icon="lucide:shield" class="size-3.5" />
                SESSION TOKEN
                <span class="text-text-dim">(optional)</span>
              </label>
              <textarea
                id="sessionToken"
                v-model="form.sessionToken"
                rows="3"
                autocomplete="off"
                spellcheck="false"
                placeholder="For temporary credentials (STS AssumeRole)"
                class="w-full resize-none border border-border-default bg-bg-deep px-3 py-2.5 font-mono text-xs text-text-primary placeholder:text-text-dim focus:border-accent-coral focus:outline-none"
              />
            </div>
          </div>

          <!-- CORS notice -->
          <div class="mb-5 flex gap-2.5 border border-accent-amber/30 bg-accent-amber/5 p-3">
            <Icon icon="lucide:info" class="mt-0.5 size-4 shrink-0 text-accent-amber" />
            <p class="text-xs leading-relaxed text-text-secondary">
              AWS Cost Explorer API does not support direct browser access (CORS restriction).
              Credentials will be saved locally. If connection fails, demo data will be shown.
            </p>
          </div>

          <!-- Actions -->
          <button
            type="submit"
            class="flex w-full items-center justify-center gap-2 bg-accent-coral px-4 py-3 font-display text-sm font-semibold text-bg-deep transition-opacity hover:opacity-90"
          >
            <Icon icon="lucide:plug" class="size-4" />
            Connect to AWS
          </button>
        </form>

        <div class="mt-3 flex items-center gap-3">
          <div class="h-px flex-1 bg-border-default" />
          <span class="text-xs text-text-dim">or</span>
          <div class="h-px flex-1 bg-border-default" />
        </div>

        <button
          type="button"
          class="mt-3 flex w-full items-center justify-center gap-2 border border-border-default bg-bg-elevated px-4 py-3 font-display text-sm text-text-secondary transition-colors hover:border-accent-sky hover:text-accent-sky"
          @click="handleDemo"
        >
          <Icon icon="lucide:layout-dashboard" class="size-4" />
          Try with Demo Data
        </button>
      </div>

      <!-- Security note -->
      <p class="mt-4 text-center text-xs text-text-dim">
        <Icon icon="lucide:shield-check" class="mr-1 inline size-3.5 text-accent-sky" />
        Credentials are stored only in your browser's localStorage. Never sent to any server.
      </p>
    </div>
  </div>
</template>
