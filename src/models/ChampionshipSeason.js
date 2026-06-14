import mongoose from 'mongoose';

const { Schema } = mongoose;

const scoringRulesSchema = new Schema(
  {
    post:             { type: Number, default: 10, min: 0 },
    comment:          { type: Number, default: 3,  min: 0 },
    upvoteReceived:   { type: Number, default: 2,  min: 0 },
    showcasePost:     { type: Number, default: 20, min: 0 },
    featureRequest:   { type: Number, default: 8,  min: 0 },
    bugReport:        { type: Number, default: 5,  min: 0 },
    pollCreated:      { type: Number, default: 4,  min: 0 },
  },
  { _id: false }
);

const topClubEntrySchema = new Schema(
  {
    rank:  { type: Number },
    club:  { type: Schema.Types.ObjectId, ref: 'ProductClub' },
    score: { type: Number },
  },
  { _id: false }
);

const rewardsSchema = new Schema(
  {
    first:  { type: String, default: 'season-champion' },
    second: { type: String, default: 'season-runner-up' },
    third:  { type: String, default: 'season-third-place' },
  },
  { _id: false }
);

const ChampionshipSeasonSchema = new Schema(
  {
    name: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 100,
    },
    slug: {
      type:     String,
      required: true,
      unique:   true,
      lowercase: true,
    },
    description: {
      type:      String,
      maxlength: 500,
    },
    status: {
      type:    String,
      enum:    ['upcoming', 'active', 'ended'],
      default: 'upcoming',
      index:   true,
    },
    startDate: {
      type:     Date,
      required: true,
    },
    endDate: {
      type:     Date,
      required: true,
    },
    finalizedAt: {
      type: Date,
    },
    scoringRules: {
      type:    scoringRulesSchema,
      default: () => ({}),
    },
    topClubs: {
      type:    [topClubEntrySchema],
      default: [],
    },
    rewards: {
      type:    rewardsSchema,
      default: () => ({}),
    },
    createdBy: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Additional indexes on startDate and endDate
ChampionshipSeasonSchema.index({ startDate: 1 });
ChampionshipSeasonSchema.index({ endDate: 1 });

// Pre-validate hook: endDate must be after startDate
ChampionshipSeasonSchema.pre('validate', function (next) {
  if (this.endDate && this.startDate && this.endDate <= this.startDate) {
    next(new Error('endDate must be after startDate'));
  } else {
    next();
  }
});

export const ChampionshipSeason = mongoose.model('ChampionshipSeason', ChampionshipSeasonSchema);
