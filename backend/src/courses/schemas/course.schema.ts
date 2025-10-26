/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CourseDocument = Course & Document;

@Schema({ timestamps: true })
export class Course {
  @Prop({ required: true, index: true })
  title: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop()
  description?: string;

  @Prop({ default: 'beginner' })
  level?: string;

  @Prop({ type: [{ title: String, url: String, duration: Number }] })
  lessons?: Array<{ title: string; url: string; duration?: number }>;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ default: false })
  published?: boolean;
}

export const CourseSchema = SchemaFactory.createForClass(Course);
// Normalize mongoose output: map _id to id, remove __v, keep timestamps
type CourseRaw = Course & { _id?: Types.ObjectId; __v?: number; id?: string };

CourseSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc: Document, ret: CourseRaw) => {
    if (
      ret &&
      typeof ret === 'object' &&
      Object.prototype.hasOwnProperty.call(ret, '_id')
    ) {
      const idVal = ret._id;
      if (idVal != null) {
        // Types.ObjectId has a toString method
        // assign id string and also keep _id as a string for adapters
        const idStr = idVal.toString();
        ret.id = idStr;
        // keep _id as string too so AdminJS and other consumers that
        // reference _id won't encounter undefined values or call
        // toString on an undefined value in the frontend.
        ret._id = idStr as any;
      }
    }
    // createdAt/updatedAt are Dates -> JSON will convert to ISO strings automatically
    return ret;
  },
});

CourseSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
  transform: (_doc: Document, ret: CourseRaw) => {
    if (
      ret &&
      typeof ret === 'object' &&
      Object.prototype.hasOwnProperty.call(ret, '_id')
    ) {
      const idVal = ret._id;
      if (idVal != null) {
        const idStr = idVal.toString();
        ret.id = idStr;
        ret._id = idStr as any;
      }
    }
    return ret;
  },
});
