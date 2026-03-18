import { z } from "zod";

export const emailBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), text: z.string().max(500) }),
  z.object({ type: z.literal("text"), text: z.string().max(20_000) }),
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
