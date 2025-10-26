import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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
