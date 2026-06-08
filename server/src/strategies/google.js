import dotenv from 'dotenv';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Setting } from '../models/Setting.js';
import { User } from '../models/User.js';

dotenv.config();

const hasGoogleConfig = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;

if (hasGoogleConfig) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.API_BASE_URL || 'http://localhost:4000'}/api/session/google/callback`
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const avatarUrl = profile.photos?.[0]?.value;
          const user = await User.findOneAndUpdate(
            { googleId: profile.id },
            {
              googleId: profile.id,
              email,
              displayName: profile.displayName || email,
              authProvider: 'google',
              avatarUrl
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
          );

          await Setting.findOneAndUpdate(
            { userId: user._id },
            { $setOnInsert: { userId: user._id } },
            { upsert: true, new: true }
          );

          done(null, user);
        } catch (error) {
          done(error);
        }
      }
    )
  );
}

export const googleAuthConfigured = Boolean(hasGoogleConfig);