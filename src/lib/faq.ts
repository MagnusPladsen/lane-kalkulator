/** Which questions each page answers (texts in i18n under faq.items). Also used for JSON-LD. */
export const CALC_FAQ = ["extra", "rates", "interestOnly", "type", "finishBy", "startlan", "method", "privacy"] as const
export const COMPARE_FAQ = ["compareHow", "switch", "rates", "method", "privacy"] as const
export type FaqId = (typeof CALC_FAQ)[number] | (typeof COMPARE_FAQ)[number]
