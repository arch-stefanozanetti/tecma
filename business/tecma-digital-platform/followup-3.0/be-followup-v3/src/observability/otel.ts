import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { ATTR_SERVICE_NAME, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from "@opentelemetry/semantic-conventions";
import { ENV } from "../config/env.js";
import { logger } from "./logger.js";

let sdk: NodeSDK | null = null;

const otelDebugEnabled =
  typeof process.env.OTEL_DEBUG === "string" &&
  ["1", "true", "yes"].includes(process.env.OTEL_DEBUG.toLowerCase());

if (otelDebugEnabled) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
}

function buildTraceExporter(): OTLPTraceExporter {
  const url =
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  return new OTLPTraceExporter(url ? { url } : undefined);
}

function buildMetricReader(): PeriodicExportingMetricReader {
  const url =
    process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ??
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  return new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(url ? { url } : undefined),
    exportIntervalMillis: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL_MS ?? 10_000),
  });
}

export async function initOtel(): Promise<void> {
  if (sdk) return;

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: "be-followup-v3",
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: ENV.APP_ENV,
    }),
    traceExporter: buildTraceExporter(),
    metricReader: buildMetricReader(),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  await sdk.start();
  logger.info("OpenTelemetry initialized");
}

export async function shutdownOtel(): Promise<void> {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = null;
  logger.info("OpenTelemetry shutdown completed");
}
