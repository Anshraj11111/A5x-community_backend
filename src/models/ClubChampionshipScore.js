import mongoose from 'mongoose';

const { Schema } = mongoose;

const ClubChampionshipScoreSchema = new Schema(
  {
    season: { type: Schema.Types.ObjectId, ref: 'ChampionshipSeason', required: true, index: true },
    club: { type: Schema.Types.ObjectId, ref: 'ProductClub', required: true, index: true },
    totalScore: { type: Number, default: 0, min: 0, index: true },
    breakdown: {
      post: { type: Number, default: 0 },
      comment: { type: Number, default: 0 },
      upvoteReceived: { type: Number, default: 0 },
      showcasePost: { type: Number, default: 0 },
      featureRequest: { type: Number, default: 0 },
      bugReport: { type: Number, default: 0 },
      pollCreated: { type: Number, default: 0 },
    },
    rank: { type: Number },
    lastScoredAt: { type: Date },
  },
  { timestamps: true }
);

// Compound unique index: one score document per club per season
ClubChampionshipScoreSchema.index({ season: 1, club: 1 }, { unique: true });

// Compound leaderboard index: fetch ranked list for a season efficiently
ClubChampionshipScoreSchema.index({ season: 1, totalScore: -1 });

export const ClubChampionshipScore = mongoose.model('ClubChampionshipScore', ClubChampionshipScoreSchema);
