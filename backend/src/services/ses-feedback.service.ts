import type { SQSRecord } from 'aws-lambda';

import type {
    SesFeedbackEvent,
    SesFeedbackResult,
    SesFeedbackType,
} from '#repositories/ses-feedback.repository';

import { applySesFeedbackEvent } from '#repositories/ses-feedback.repository';



type JsonRecord = Record<string, unknown>;

const _isRecord = (value: unknown): value is JsonRecord =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const _parseJson = (value: string, context: string): unknown => {
    try {
        return JSON.parse(value) as unknown;
    } catch (error) {
        throw new Error(`${context} is not valid JSON`, { cause: error });
    }
};

const _requiredRecord = (value: unknown, name: string): JsonRecord => {
    if (!_isRecord(value)) {
        throw new Error(`SES feedback ${name} must be an object`);
    }
    return value;
};

const _requiredString = (value: unknown, name: string): string => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`SES feedback ${name} must be a non-empty string`);
    }
    return value.trim();
};

const _eventType = (payload: JsonRecord): SesFeedbackType | 'send' => {
    const value = payload.eventType ?? payload.notificationType;
    if (value === 'Send') {
        return 'send';
    }
    if (value === 'Delivery') {
        return 'delivery';
    }
    if (value === 'Bounce') {
        return 'bounce';
    }
    if (value === 'Complaint') {
        return 'complaint';
    }
    throw new Error(`Unsupported SES feedback event type: ${String(value)}`);
};

const _eventDate = (value: unknown, eventType: SesFeedbackType): string => {
    const raw = _requiredString(value, `${eventType}.timestamp`);
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`SES feedback ${eventType}.timestamp is invalid`);
    }
    return date.toISOString();
};

const _readEvent = (record: SQSRecord): SesFeedbackEvent | null => {
    const sqsBody = _requiredRecord(_parseJson(record.body, 'SQS record body'), 'SQS body');
    if (sqsBody.Type !== 'Notification' || typeof sqsBody.Message !== 'string') {
        throw new Error('SQS record body is not an SNS Notification envelope');
    }

    const payload = _requiredRecord(
        _parseJson(sqsBody.Message, 'SNS Message'),
        'event payload',
    );
    const eventType = _eventType(payload);
    const mail = _requiredRecord(payload.mail, 'mail');
    const sesMessageId = _requiredString(mail.messageId, 'mail.messageId');
    if (eventType === 'send') {
        return null;
    }

    const feedback = _requiredRecord(payload[eventType], eventType);
    const eventAt = _eventDate(feedback.timestamp, eventType);

    if (eventType === 'delivery') {
        return {
            sesMessageId,
            eventType,
            status: 'delivered',
            eventAt,
            payload,
            shouldSuppress: false,
            diagnostics: null,
        };
    }

    if (eventType === 'bounce') {
        const bounceType = _requiredString(feedback.bounceType, 'bounce.bounceType');
        if (bounceType !== 'Permanent' && bounceType !== 'Transient' && bounceType !== 'Undetermined') {
            throw new Error(`Unsupported SES bounce type: ${bounceType}`);
        }
        const bouncedRecipients = feedback.bouncedRecipients;
        if (!Array.isArray(bouncedRecipients) || bouncedRecipients.length === 0) {
            throw new Error('SES feedback bounce.bouncedRecipients must be a non-empty array');
        }
        const diagnostics = {
            bounceType,
            bounceSubType: feedback.bounceSubType ?? null,
            bouncedRecipients,
        };
        return {
            sesMessageId,
            eventType,
            status: 'bounced',
            eventAt,
            payload,
            shouldSuppress: bounceType === 'Permanent',
            diagnostics,
        };
    }

    const diagnostics = {
        complaintSubType: feedback.complaintSubType ?? null,
        feedbackId: feedback.feedbackId ?? null,
        complainedRecipients: feedback.complainedRecipients ?? null,
    };
    return {
        sesMessageId,
        eventType,
        status: 'complained',
        eventAt,
        payload,
        shouldSuppress: true,
        diagnostics,
    };
};

export const processSesFeedbackRecord = async (
    record: SQSRecord,
    applyEvent: (event: SesFeedbackEvent) => Promise<SesFeedbackResult> = applySesFeedbackEvent,
): Promise<SesFeedbackResult> => {
    const event = _readEvent(record);
    if (!event) {
        return 'ignored';
    }
    return applyEvent(event);
};
