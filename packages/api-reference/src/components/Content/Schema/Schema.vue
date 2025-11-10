<script lang="ts" setup>
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue'
import { ScalarIcon, ScalarMarkdown } from '@scalar/components'
import type { OpenAPIV3_1 } from '@scalar/openapi-types'
import { computed, inject, ref, watch } from 'vue'

import ScreenReader from '@/components/ScreenReader.vue'
import type { Schemas } from '@/features/Operation/types/schemas'
import {
  SCHEMA_ORDERING_OVERRIDE,
  type SchemaOrderingOverride,
} from '@/hooks/schemaOrdering'
import { useConfig } from '@/hooks/useConfig'
import { DISCRIMINATOR_CONTEXT } from '@/hooks/useDiscriminator'

import SchemaHeading from './SchemaHeading.vue'
import SchemaProperty from './SchemaProperty.vue'

const props = withDefaults(
  defineProps<{
    value?:
      | OpenAPIV3_1.OperationObject
      | OpenAPIV3_1.SchemaObject
      | OpenAPIV3_1.ArraySchemaObject
      | OpenAPIV3_1.NonArraySchemaObject
      | OpenAPIV3_1.SchemaObject
      | OpenAPIV3_1.ArraySchemaObject
      | OpenAPIV3_1.NonArraySchemaObject
    /** Track how deep we've gone */
    level?: number
    /* Show as a heading */
    name?: string
    /** A tighter layout with less borders and without a heading */
    compact?: boolean
    /** Shows a toggle to hide/show children */
    noncollapsible?: boolean
    hideHeading?: boolean
    /** Show a special one way toggle for additional properties, also has a top border when open */
    additionalProperties?: boolean
    /** Hide model names in type display */
    hideModelNames?: boolean
    /** All schemas for model name retrieval */
    schemas?: Schemas
    /** Selected discriminator */
    discriminator?: string
    /** Discriminator mapping */
    discriminatorMapping?: Record<string, string>
    /** Discriminator property name */
    discriminatorPropertyName?: string
    /** Whether the schema has a discriminator */
    hasDiscriminator?: boolean
  }>(),
  { level: 0, noncollapsible: false, hideModelNames: false },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

// Inject the discriminator context
const discriminatorContext = inject(DISCRIMINATOR_CONTEXT, null)

// Use injected context values or fallback to props for backward compatibility
const discriminatorMapping = computed(
  () =>
    discriminatorContext?.value?.discriminatorMapping ||
    props.discriminatorMapping ||
    {},
)
const discriminatorPropertyName = computed(
  () =>
    discriminatorContext?.value?.discriminatorPropertyName ||
    props.discriminatorPropertyName ||
    '',
)
const discriminator = computed(
  () => discriminatorContext?.value?.selectedType || props.discriminator,
)

/* Returns true if the schema is an object schema */
const isObjectSchema = (
  schema: unknown,
): schema is OpenAPIV3_1.SchemaObject => {
  return (
    schema !== null &&
    typeof schema === 'object' &&
    'type' in schema &&
    schema.type === 'object'
  )
}

/* Returns the resolved schema from discriminator context when available for display */
const schema = computed(() => {
  // Get the merged schema from the discriminator context
  const mergedSchema = discriminatorContext?.value?.mergedSchema

  // Get the original schema from the props
  const originalSchema = props.value

  // If the merged schema is an object schema and the original schema is an object schema, return the merged schema
  if (
    mergedSchema &&
    props.level === 0 &&
    props.hasDiscriminator &&
    isObjectSchema(originalSchema) &&
    isObjectSchema(mergedSchema)
  ) {
    return mergedSchema
  }

  // Otherwise fall back to the resolved schema prop or value prop
  return props.value
})

const shouldShowToggle = computed(() => {
  // Allow the special "additionalProperties" one-way toggle even at level 0
  // so that partitioned/collapsed schemas can remain design-consistent while
  // still being hidden until the user expands them.
  if (props.noncollapsible) {
    return false
  }

  if (props.level === 0 && !props.additionalProperties) {
    return false
  }

  return true
})

/** Determines whether to show the schema description */
const shouldShowDescription = computed(() => {
  // Don't show description if there's no description or it's not a string
  if (
    !schema.value?.description ||
    typeof schema.value.description !== 'string'
  ) {
    return false
  }

  // Don't show description if the schema has composition keywords
  // This prevents duplicate descriptions when individual schemas are part of compositions
  if (schema.value.allOf || schema.value.oneOf || schema.value.anyOf) {
    return false
  }

  // Don't show description for enum schemas (they have special handling)
  if (schema.value.enum) {
    return false
  }

  // Merged allOf schemas at level 0 should not show individual descriptions
  // to prevent duplicates with the request body description
  if (props.level === 0) {
    return false
  }

  return true
})

// Limit the number of properties shown initially for large schemas.
// Clicking the "Show additional properties" button will reveal all properties.
const initialPropertyLimit = 12
const showAllProperties = ref(false)
const propertyKeys = computed(() =>
  schema.value && typeof schema.value === 'object' && schema.value.properties
    ? Object.keys(schema.value.properties)
    : [],
)

/**
 * Compute a sorted list of property keys based on configuration.
 * By default we preserve the original order unless the config requests sorting.
 */
const config = useConfig()

// UI override values (per-page/per-component). Initialize from global config.
// Allow an injected override (provided by the operation parameters UI) to control
// ordering at runtime. If no override is provided, fall back to local refs.
const injectedOrdering = inject<SchemaOrderingOverride | null>(
  SCHEMA_ORDERING_OVERRIDE,
  null,
)

const uiOrder = injectedOrdering
  ? injectedOrdering.order
  : ref<string>(config.value.orderSchemaPropertiesBy ?? 'alpha')
const uiReqFirst = injectedOrdering
  ? injectedOrdering.reqFirst
  : ref<boolean>(
      config.value.orderRequiredPropertiesFirst === undefined
        ? true
        : Boolean(config.value.orderRequiredPropertiesFirst),
    )

// If there is no injected override, keep ui values in sync with global config
if (!injectedOrdering) {
  watch(
    () => config.value.orderSchemaPropertiesBy,
    (v) => {
      if (v !== undefined) uiOrder.value = v as string
    },
  )
  watch(
    () => config.value.orderRequiredPropertiesFirst,
    (v) => {
      if (v !== undefined) uiReqFirst.value = Boolean(v)
    },
  )
}

const sortedPropertyKeys = computed(() => {
  const keys = propertyKeys.value ? propertyKeys.value.slice() : []

  // Nothing to sort
  if (!keys.length) return keys

  const sorter = uiOrder.value
  const reqFirst = Boolean(uiReqFirst.value)

  // Helper for alphabetical sort by property name
  const alphaCompare = (a: string, b: string) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

  // Partition required/optional if requested
  let requiredKeys: string[] = []
  let optionalKeys: string[] = []
  if (reqFirst && schema.value && typeof schema.value === 'object') {
    const requiredSet = new Set(
      Array.isArray(schema.value.required) ? schema.value.required : [],
    )
    for (const k of keys) {
      if (requiredSet.has(k)) requiredKeys.push(k)
      else optionalKeys.push(k)
    }
  } else {
    requiredKeys = keys
    optionalKeys = []
  }

  const sortGroup = (arr: string[]) => {
    if (!arr || arr.length <= 1) return arr

    // 'preserve' means keep original order
    if (!sorter || sorter === 'preserve') return arr

    try {
      if (sorter === 'alpha') {
        return arr.slice().sort(alphaCompare)
      }

      if (typeof sorter === 'function') {
        // comparator receives two schema objects (if available), fallback to names
        return arr.slice().sort((a, b) => {
          try {
            const left = schema.value?.properties?.[a]
            const right = schema.value?.properties?.[b]
            // Call user's comparator with schema objects if present
            return (sorter as any)(left ?? a, right ?? b) as number
          } catch (e) {
            return alphaCompare(a, b)
          }
        })
      }
    } catch (e) {
      // If comparator fails, fall back to alphabetical
      return arr.slice().sort(alphaCompare)
    }

    return arr
  }

  const sortedRequired = sortGroup(requiredKeys)
  const sortedOptional = sortGroup(optionalKeys)

  return reqFirst ? [...sortedRequired, ...sortedOptional] : sortedRequired
})
const visibleProperties = computed(() => {
  // If this Schema instance represents the collapsed 'additionalProperties'
  // section (request body partitioning), don't apply a second layer of
  // truncation — show all properties and let the parent control collapsing.
  if (props.additionalProperties) {
    return sortedPropertyKeys.value
  }

  return showAllProperties.value
    ? sortedPropertyKeys.value
    : sortedPropertyKeys.value.slice(0, initialPropertyLimit)
})

const hasMoreProperties = computed(() => {
  if (props.additionalProperties) {
    return false
  }
  return sortedPropertyKeys.value.length > initialPropertyLimit
})

const revealAllProperties = () => {
  showAllProperties.value = true
}

// Prevent click action if noncollapsible
const handleClick = (e: MouseEvent) =>
  props.noncollapsible && e.stopPropagation()

const handleDiscriminatorChange = (type: string) => {
  emit('update:modelValue', type)
}
</script>
<template>
  <Disclosure
    v-if="typeof value === 'object' && Object.keys(value).length"
    v-slot="{ open }"
    :defaultOpen="noncollapsible">
    <div
      class="schema-card"
      :class="[
        `schema-card--level-${level}`,
        { 'schema-card--compact': compact, 'schema-card--open': open },
        { 'border-t': additionalProperties && open },
      ]">
      <!-- Schema description -->
      <div
        v-if="shouldShowDescription"
        class="schema-card-description">
        <template v-if="!schema?.enum">
          <ScalarMarkdown :value="schema?.description" />
        </template>
      </div>
      <div
        class="schema-properties"
        :class="{
          'schema-properties-open': open,
        }">
        <!-- Special toggle to show additional properties -->
        <div
          v-if="additionalProperties"
          v-show="!open"
          class="schema-properties">
          <DisclosureButton
            as="button"
            class="schema-card-title schema-card-title--compact"
            @click.capture="handleClick">
            <ScalarIcon
              class="schema-card-title-icon"
              icon="Add"
              size="sm" />
            Show additional properties
            <ScreenReader v-if="name">for {{ name }}</ScreenReader>
          </DisclosureButton>
        </div>

        <DisclosureButton
          v-else-if="shouldShowToggle"
          v-show="!hideHeading && !(noncollapsible && compact)"
          :as="noncollapsible ? 'div' : 'button'"
          class="schema-card-title"
          :class="{ 'schema-card-title--compact': compact }"
          :style="{
            top: `calc(var(--refs-header-height) +  calc(var(--schema-title-height) * ${level}))`,
          }"
          @click.capture="handleClick">
          <template v-if="compact">
            <ScalarIcon
              class="schema-card-title-icon"
              :class="{ 'schema-card-title-icon--open': open }"
              icon="Add"
              size="sm" />
            <template v-if="open">
              Hide {{ value?.title ?? 'Child Attributes' }}
            </template>
            <template v-else>
              Show {{ value?.title ?? 'Child Attributes' }}
            </template>
            <ScreenReader v-if="name">for {{ name }}</ScreenReader>
          </template>
          <template v-else>
            <ScalarIcon
              class="schema-card-title-icon"
              :class="{ 'schema-card-title-icon--open': open }"
              icon="Add"
              size="sm" />
            <SchemaHeading
              :name="(value?.title ?? name) as string"
              :value="value" />
          </template>
        </DisclosureButton>
        <DisclosurePanel
          as="ul"
          :static="!shouldShowToggle">
          <!-- Schema properties -->
          <template
            v-if="
              schema &&
              typeof schema === 'object' &&
              ('properties' in schema ||
                'additionalProperties' in schema ||
                'patternProperties' in schema)
            ">
            <!-- Regular properties -->
            <template v-if="schema.properties">
              <SchemaProperty
                v-for="property in visibleProperties"
                :key="property"
                :compact="compact"
                :hideHeading="hideHeading"
                :level="level + 1"
                :name="property"
                :hideModelNames="hideModelNames"
                :required="
                  schema.required?.includes(property) ||
                  schema.properties[property]?.required === true
                "
                :schemas="schemas"
                :resolvedSchema="schema.properties[property]"
                :value="{
                  ...schema.properties[property],
                  parent: schema,
                  isDiscriminator:
                    property === discriminatorPropertyName ||
                    schema.discriminator?.propertyName === property,
                }"
                :discriminatorMapping="
                  schema.discriminator?.mapping || discriminatorMapping
                "
                :discriminatorPropertyName="
                  schema.discriminator?.propertyName ||
                  discriminatorPropertyName
                "
                :isDiscriminator="
                  property ===
                  (schema.discriminator?.propertyName ||
                    discriminatorPropertyName)
                "
                :modelValue="discriminator"
                @update:modelValue="handleDiscriminatorChange" />

              <!-- Show the 'Show additional properties' button if there are more properties than the initial limit -->
              <div
                v-if="hasMoreProperties && !showAllProperties"
                class="schema-properties">
                <button
                  class="schema-card-title schema-card-title--compact"
                  type="button"
                  @click.prevent="revealAllProperties">
                  <ScalarIcon
                    class="schema-card-title-icon"
                    icon="Add"
                    size="sm" />
                  Show additional properties
                  <ScreenReader v-if="name">for {{ name }}</ScreenReader>
                </button>
              </div>
            </template>

            <!-- Pattern properties -->
            <template v-if="schema.patternProperties">
              <SchemaProperty
                v-for="property in Object.keys(schema.patternProperties)"
                :key="property"
                :compact="compact"
                :hideHeading="hideHeading"
                :level="level"
                :name="property"
                :hideModelNames="hideModelNames"
                pattern
                :schemas="schemas"
                :value="
                  value.discriminator?.propertyName === property
                    ? value
                    : schema.patternProperties[property]
                "
                :discriminatorMapping="discriminatorMapping"
                :discriminatorPropertyName="discriminatorPropertyName"
                @update:modelValue="handleDiscriminatorChange" />
            </template>

            <!-- Additional properties -->
            <template v-if="schema.additionalProperties">
              <!--
                Allows any type of additional property value
                @see https://swagger.io/docs/specification/data-models/dictionaries/#free-form
               -->
              <SchemaProperty
                v-if="
                  schema.additionalProperties === true ||
                  Object.keys(schema.additionalProperties).length === 0 ||
                  !('type' in schema.additionalProperties)
                "
                additional
                :compact="compact"
                :hideHeading="hideHeading"
                :hideModelNames="hideModelNames"
                :level="level"
                noncollapsible
                :schemas="schemas"
                :value="{
                  type: 'anything',
                  ...(typeof schema.additionalProperties === 'object'
                    ? schema.additionalProperties
                    : {}),
                }"
                :discriminatorMapping="discriminatorMapping"
                :discriminatorPropertyName="discriminatorPropertyName"
                @update:modelValue="handleDiscriminatorChange" />
              <SchemaProperty
                v-else
                additional
                :compact="compact"
                :hideHeading="hideHeading"
                :hideModelNames="hideModelNames"
                :level="level"
                noncollapsible
                :schemas="schemas"
                :value="
                  value.discriminator?.propertyName === name
                    ? value
                    : schema.additionalProperties
                "
                :discriminatorMapping="discriminatorMapping"
                :discriminatorPropertyName="discriminatorPropertyName"
                @update:modelValue="handleDiscriminatorChange" />
            </template>
          </template>

          <!-- Single property -->
          <template v-else>
            <SchemaProperty
              v-if="schema"
              :compact="compact"
              :hideHeading="hideHeading"
              :hideModelNames="hideModelNames"
              :level="level"
              :name="(schema as OpenAPIV3_1.SchemaObject).name"
              :schemas="schemas"
              :value="
                value.discriminator?.propertyName === name ? value : schema
              "
              :discriminatorMapping="discriminatorMapping"
              :discriminatorPropertyName="discriminatorPropertyName"
              :modelValue="discriminator"
              @update:modelValue="handleDiscriminatorChange" />
          </template>
        </DisclosurePanel>
      </div>
    </div>
  </Disclosure>
</template>
<style scoped>
.error {
  background-color: var(--scalar-color-red);
}
.schema-card {
  z-index: 0;
  font-size: var(--scalar-font-size-4);
  color: var(--scalar-color-1);
}
.schema-card-title {
  height: var(--schema-title-height);

  padding: 6px 8px;

  display: flex;
  align-items: center;
  gap: 4px;

  color: var(--scalar-color-2);
  font-weight: var(--scalar-semibold);
  font-size: var(--scalar-micro);
  border-bottom: var(--scalar-border-width) solid transparent;
}
button.schema-card-title {
  cursor: pointer;
}
button.schema-card-title:hover {
  color: var(--scalar-color-1);
}
.schema-card-title-icon--open {
  transform: rotate(45deg);
}
.schema-properties-open > .schema-card-title {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom: var(--scalar-border-width) solid var(--scalar-border-color);
}
.schema-properties-open > .schema-properties {
  width: fit-content;
}
.schema-card-description + .schema-properties {
  width: fit-content;
}
.schema-card-description + .schema-properties {
  margin-top: 8px;
}
.schema-properties-open.schema-properties,
.schema-properties-open > .schema-card--open {
  width: 100%;
}

.schema-properties {
  display: flex;
  flex-direction: column;

  border: var(--scalar-border-width) solid var(--scalar-border-color);
  border-radius: var(--scalar-radius-lg);
  width: fit-content;
}
.schema-properties-name {
  width: 100%;
}
.schema-properties .schema-properties {
  border-radius: 13.5px;
}
.schema-properties .schema-properties.schema-properties-open {
  border-radius: var(--scalar-radius-lg);
}
.schema-properties-open {
  width: 100%;
}
.schema-card--compact {
  align-self: flex-start;
}
.schema-card--compact.schema-card--open {
  align-self: initial;
}
.schema-card-title--compact {
  color: var(--scalar-color-2);
  padding: 6px;
  height: auto;
  border-bottom: none;
}
.schema-card-title--compact > .schema-card-title-icon {
  margin: 0;
}
.schema-card-title--compact > .schema-card-title-icon--open {
  transform: rotate(45deg);
}
.schema-properties-open > .schema-card-title--compact {
  position: static;
}
.property--level-0
  > .schema-properties
  > .schema-card--level-0
  > .schema-properties {
  border: none;
}
.property--level-0
  .schema-card--level-0:not(.schema-card--compact)
  .property--level-1 {
  padding: 0 0 8px;
}
:not(.composition-panel)
  > .schema-card--compact.schema-card--level-0
  > .schema-properties {
  border: none;
}
:deep(.schema-card-description) p {
  font-size: var(--scalar-mini, var(--scalar-paragraph));
  color: var(--scalar-color-2);
  line-height: 1.5;
  margin-bottom: 0;
  display: block;
  margin-bottom: 6px;
}
.children .schema-card-description:first-of-type {
  padding-top: 0;
}
</style>
