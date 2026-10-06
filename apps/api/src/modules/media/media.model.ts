import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * Uploaded images, stored in MongoDB. Every upload is re-encoded by sharp
 * before storage, so documents stay small (~50–250 KB) and only contain
 * pixels we produced — never the original file bytes.
 */
const MediaSchema = new Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    originalName: { type: String, maxlength: 255 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type Media = InferSchemaType<typeof MediaSchema>;
export const MediaModel = model('Media', MediaSchema);
