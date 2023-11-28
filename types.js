const jaegerClient = require('jaeger-client');

const { diag } = require('@opentelemetry/api');
const {
  SpanStatusCode,
  SpanKind,
} = require('@opentelemetry/api');

const {
  hrTimeToMilliseconds,
  hrTimeToMicroseconds,
} = require('@opentelemetry/core');

const {
  ThriftReferenceType,
  UDPSender,
  Utils,
  ThriftUtils,
  HTTPSender,
} = require('jaeger-client');

const DEFAULT_FLAGS = 0x1;

function spanToThrift(span) {
  const traceId = span.spanContext().traceId.padStart(32, '0');
  const traceIdHigh = traceId.slice(0, 16);
  const traceIdLow = traceId.slice(16);
  const parentSpan = span.parentSpanId
    ? Utils.encodeInt64(span.parentSpanId)
    : ThriftUtils.emptyBuffer;

  const tags = Object.keys(span.attributes).map(
    (name) => ({ key: name, value: toTagValue(span.attributes[name]) })
  );
  if (span.status.code !== SpanStatusCode.UNSET) {
    tags.push({
      key: 'otel.status_code',
      value: SpanStatusCode[span.status.code],
    });
    if (span.status.message) {
      tags.push({ key: 'otel.status_description', value: span.status.message });
    }
  }
  if (span.status.code === SpanStatusCode.ERROR) {
    tags.push({ key: 'error', value: true });
  }

  if (span.kind !== undefined && span.kind !== SpanKind.INTERNAL) {
    tags.push({ key: 'span.kind', value: SpanKind[span.kind].toLowerCase() });
  }
  Object.keys(span.resource.attributes).forEach(name =>
    tags.push({
      key: name,
      value: toTagValue(span.resource.attributes[name]),
    })
  );

  if (span.instrumentationLibrary) {
    tags.push({
      key: 'otel.library.name',
      value: toTagValue(span.instrumentationLibrary.name),
    });
    tags.push({
      key: 'otel.library.version',
      value: toTagValue(span.instrumentationLibrary.version),
    });
  }

  if (span.droppedAttributesCount) {
    tags.push({
      key: 'otel.dropped_attributes_count',
      value: toTagValue(span.droppedAttributesCount),
    });
  }

  if (span.droppedEventsCount) {
    tags.push({
      key: 'otel.dropped_events_count',
      value: toTagValue(span.droppedEventsCount),
    });
  }

  if (span.droppedLinksCount) {
    tags.push({
      key: 'otel.dropped_links_count',
      value: toTagValue(span.droppedLinksCount),
    });
  }

  const spanTags = ThriftUtils.getThriftTags(tags);

  const logs = span.events.map((event) => {
    const fields = [{ key: 'event', value: event.name }];
    const attrs = event.attributes;
    if (attrs) {
      Object.keys(attrs).forEach(attr =>
        fields.push({ key: attr, value: toTagValue(attrs[attr]) })
      );
    }
    if (event.droppedAttributesCount) {
      fields.push({
        key: 'otel.event.dropped_attributes_count',
        value: event.droppedAttributesCount,
      });
    }
    return { timestamp: hrTimeToMilliseconds(event.time), fields };
  });
  const spanLogs = ThriftUtils.getThriftLogs(logs);

  return {
    traceIdLow: Utils.encodeInt64(traceIdLow),
    traceIdHigh: Utils.encodeInt64(traceIdHigh),
    spanId: Utils.encodeInt64(span.spanContext().spanId),
    parentSpanId: parentSpan,
    operationName: span.name,
    references: spanLinksToThriftRefs(span.links),
    flags: span.spanContext().traceFlags || DEFAULT_FLAGS,
    startTime: Utils.encodeInt64(hrTimeToMicroseconds(span.startTime)),
    duration: Utils.encodeInt64(hrTimeToMicroseconds(span.duration)),
    tags: spanTags,
    logs: spanLogs,
  };
}

function spanLinksToThriftRefs(links) {
  return links.map((link) => {
    const refType = ThriftReferenceType.FOLLOWS_FROM;
    const traceId = link.context.traceId;
    const traceIdHigh = Utils.encodeInt64(traceId.slice(0, 16));
    const traceIdLow = Utils.encodeInt64(traceId.slice(16));
    const spanId = Utils.encodeInt64(link.context.spanId);
    return { traceIdLow, traceIdHigh, spanId, refType };
  });
}

function toTagValue(value) {
  const valueType = typeof value;
  if (valueType === 'boolean') {
    return value;
  } else if (valueType === 'number') {
    return value;
  }
  return String(value);
}

module.exports = {
  UDPSender,
  Utils,
  ThriftUtils,
  HTTPSender,
  spanToThrift,
};
