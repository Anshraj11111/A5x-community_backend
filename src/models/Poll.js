import mongoose from 'mongoose';

const { Schema } = mongoose;

const PollSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: String, required: true, trim: true, maxlength: 300 },
    options: [
      {
        text: { type: String, required: true, trim: true, maxlength: 200 },
        voteCount: { type: Number, default: 0, min: 0 },
      },
    ],
    totalVotes: { type: Number, default: 0, min: 0 },
    endsAt: { type: Date, default: null },
    isMultiple: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Poll = mongoose.model('Poll', PollSchema);
