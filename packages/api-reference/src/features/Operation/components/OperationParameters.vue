<script setup lang="ts">
import type { OpenAPIV3_1 } from '@scalar/openapi-types'
import { provide, ref } from 'vue'

import type { Schemas } from '@/features/Operation/types/schemas'
import {
  SCHEMA_ORDERING_OVERRIDE,
  type SchemaOrderingOverride,
} from '@/hooks/schemaOrdering'
import { useConfig } from '@/hooks/useConfig'

import ParameterList from './ParameterList.vue'
import RequestBody from './RequestBody.vue'

const {
  parameters = [],
  requestBody,
  schemas,
} = defineProps<{
  parameters?: OpenAPIV3_1.ParameterObject[]
  requestBody?: OpenAPIV3_1.RequestBodyObject | undefined
  schemas?: Schemas
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const handleDiscriminatorChange = (type: string) => {
  emit('update:modelValue', type)
}

const filterParameters = (where: 'path' | 'query' | 'header' | 'cookie') =>
  parameters?.filter((parameter) => parameter.in === where) ?? []

// Provide a runtime override for schema ordering so the UI can control how
// schema properties are ordered. Defaults come from the validated global config.
const config = useConfig()
const ordering = ref<string>(config.value.orderSchemaPropertiesBy ?? 'alpha')
const reqFirst = ref<boolean>(
  config.value.orderRequiredPropertiesFirst === undefined
    ? true
    : Boolean(config.value.orderRequiredPropertiesFirst),
)

provide<SchemaOrderingOverride>(SCHEMA_ORDERING_OVERRIDE, {
  order: ordering,
  reqFirst,
})
</script>
<template>
  <div
    class="parameter-order-controls"
    style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px">
    <label style="display: flex; gap: 6px; align-items: center">
      <span style="font-size: 12px; color: var(--scalar-color-2)"
        >Property order:</span
      >
      <select
        v-model="ordering"
        style="font-size: 12px; padding: 4px">
        <option value="alpha">Alpha</option>
        <option value="preserve">Preserve</option>
      </select>
    </label>
    <label style="display: flex; gap: 6px; align-items: center">
      <input
        type="checkbox"
        v-model="reqFirst" />
      <span style="font-size: 12px; color: var(--scalar-color-2)"
        >Show required first</span
      >
    </label>
  </div>
  <!-- Path parameters-->
  <ParameterList
    :parameters="filterParameters('path')"
    :schemas="schemas">
    <template #title>Path Parameters</template>
  </ParameterList>

  <!-- Query parameters -->
  <ParameterList
    :parameters="filterParameters('query')"
    :schemas="schemas">
    <template #title>Query Parameters</template>
  </ParameterList>

  <!-- Headers -->
  <ParameterList
    :parameters="filterParameters('header')"
    :schemas="schemas">
    <template #title>Headers</template>
  </ParameterList>

  <!-- Cookies -->
  <ParameterList
    :parameters="filterParameters('cookie')"
    :schemas="schemas">
    <template #title>Cookies</template>
  </ParameterList>

  <!-- Request body -->
  <RequestBody
    v-if="requestBody"
    :requestBody="requestBody"
    :schemas="schemas"
    @update:modelValue="handleDiscriminatorChange">
    <template #title>Body</template>
  </RequestBody>
</template>
