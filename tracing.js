const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { ConsoleSpanExporter, SimpleSpanProcessor, BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { trace } = require('@opentelemetry/api');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('opentelemetry-instrumentation-express');
const { MongoDBInstrumentation } = require('@opentelemetry/instrumentation-mongodb');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');

module.exports = (serviceName) => {
  // Create Jaeger exporter
  const exporter = new JaegerExporter({
    serviceName: 'todo-service',
    // Add other Jaeger exporter options if needed
  });

  // Create tracer provider
  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    }),
  });

  // Add span processor (use BatchSpanProcessor for better performance)
  provider.addSpanProcessor(new BatchSpanProcessor(exporter));

  // Register instrumentations
  registerInstrumentations({
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new MongoDBInstrumentation(),
    ],
    tracerProvider: provider,
  });

  // Register the provider and get the tracer
  provider.register();
  return trace.getTracer(serviceName);
};
