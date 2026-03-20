import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { logger } from "../../../observability/logger.js";
import type { ProviderAdapter } from "../provider-adapter.js";
import type { DeliveryRequest, DeliveryResult, MessagingChannel, MessagingProvider, ProviderContext } from "../messaging.types.js";

function normalizePhone(raw: string): string {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("+")) return trimmed;
  return `+${trimmed.replace(/\D/g, "")}`;
}

export class AwsSmsProvider implements ProviderAdapter {
  readonly provider: MessagingProvider = "aws_sms";
  private readonly client: SNSClient;

  constructor(client?: SNSClient) {
    this.client = client ?? new SNSClient({ region: process.env.AWS_REGION || "eu-central-1" });
  }

  supports(channel: MessagingChannel): boolean {
    return channel === "sms";
  }

  async send(request: DeliveryRequest, context?: ProviderContext): Promise<DeliveryResult> {
    const to = normalizePhone(request.to);
    const senderId = process.env.AWS_SMS_SENDER_ID;

    const command = new PublishCommand({
      Message: request.body,
      PhoneNumber: to,
      MessageAttributes: senderId
        ? {
            "AWS.SNS.SMS.SenderID": {
              DataType: "String",
              StringValue: senderId,
            },
          }
        : undefined,
    });

    const response = await this.client.send(command);
    logger.info(
      {
        requestId: context?.requestId,
        tenantId: context?.tenantId,
        channel: request.channel,
        provider: this.provider,
        workspaceId: request.workspaceId,
        messageId: response.MessageId,
      },
      "[messaging] aws sms sent"
    );

    return {
      ok: true,
      provider: this.provider,
      channel: request.channel,
      externalId: response.MessageId,
      status: "queued",
    };
  }
}

