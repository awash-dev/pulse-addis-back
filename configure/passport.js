const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../configure/dbClient');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback'
},
    async (accessToken, refreshToken, profile, done) => {
        const { id, emails, name } = profile;
        const email = emails[0].value;
        const firstname = name.givenName;
        const lastname = name.familyName;

        let user = await db.user.findUnique({ where: { googleId: id } });

        if (!user) {
            // Check if user with this email exists first
            user = await db.user.findUnique({ where: { email } });
            if (user) {
                user = await db.user.update({
                   where: { email },
                   data: { googleId: id, provider: 'google' }
                });
            } else {
                user = await db.user.create({
                    data: {
                        googleId: id,
                        email,
                        firstname,
                        lastname,
                        provider: 'google',
                        password: 'OAuthAccount@123', // Dummy password
                        mobile: `oauth_${id.substring(0, 5)}` // Dummy mobile to satisfy unique constraint
                    }
                });
            }
        }

        done(null, user);
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await db.user.findUnique({ where: { id } });
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

const FacebookStrategy = require('passport-facebook').Strategy;

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: '/api/auth/facebook/callback',
    profileFields: ['id', 'emails', 'name']
},
    async (accessToken, refreshToken, profile, done) => {
        const { id, emails, name } = profile;
        const email = emails[0].value;
        const firstname = name.givenName;
        const lastname = name.familyName;

        let user = await db.user.findUnique({ where: { facebookId: id } });

        if (!user) {
            user = await db.user.findUnique({ where: { email } });
            if (user) {
                user = await db.user.update({
                   where: { email },
                   data: { facebookId: id, provider: 'facebook' }
                });
            } else {
                user = await db.user.create({
                    data: {
                        facebookId: id,
                        email,
                        firstname,
                        lastname,
                        provider: 'facebook',
                        password: 'OAuthAccount@123',
                        mobile: `oauth_fb_${id.substring(0, 5)}`
                    }
                });
            }
        }

        done(null, user);
    }
));

module.exports = passport;
