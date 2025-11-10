import type { Ref } from 'vue'

export const SCHEMA_ORDERING_OVERRIDE = Symbol('SCHEMA_ORDERING_OVERRIDE')

export type SchemaOrderingOverride = {
  order: Ref<string>
  reqFirst: Ref<boolean>
}
