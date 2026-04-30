import { z } from "zod";

export const emailBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("heading"),
    html: z.string().max(12_000).optional(),
    text: z.string().max(500).optional()
  }),
  z.object({
    type: z.literal("text"),
    html: z.string().max(40_000).optional(),
    text: z.string().max(20_000).optional()
  }),
  z.object({
    type: z.literal("button"),
    label: z.string().max(200),
    href: z.string().max(2000)
  }),
  z.object({
    type: z.literal("image"),
    src: z.string().max(2000),
    alt: z.string().max(500)
  })
]);

export const emailLayoutSchema = z.object({
  logoUrl: z.string().max(2000),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  blocks: z.array(emailBlockSchema).min(1).max(40)
});

export type EmailBlock = z.infer<typeof emailBlockSchema>;
export type EmailLayoutV1 = z.infer<typeof emailLayoutSchema>;
