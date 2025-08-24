const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');

const router = Router();
const prisma = new PrismaClient();

// Fallback in-memory storage when database is unavailable
const profileFallback = new Map();

router.use((req, _res, next) => {
  console.log('[profile-router]', req.method, req.originalUrl, 'base:', req.baseUrl, 'url:', req.url);
  next();
});

// GET /api/profile/get?email=user@example.com
router.get('/get', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { email: String(email) },
        select: {
          id: true,
          email: true,
          name: true,
          position: true,
          graduation_year: true,
          state: true,
          height: true,
          weight: true,
          profile_photo_url: true,
          video_links: true,
          privacy_setting: true,
          email_notifications: true,
          profile_complete: true,
          createdAt: true,
        }
      });
    } catch (dbError) {
      console.warn('[PROFILE] Database unavailable for GET, using fallback:', dbError.message);
      user = profileFallback.get(email);
    }

    if (!user) {
      // Return default profile structure
      user = {
        id: 1,
        email: email,
        name: null,
        position: null,
        graduation_year: null,
        state: null,
        height: null,
        weight: null,
        profile_photo_url: null,
        video_links: [],
        privacy_setting: 'public',
        email_notifications: true,
        profile_complete: false,
        createdAt: new Date(),
      };
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// POST /api/profile/update
router.post('/update', async (req, res) => {
  try {
    const { email, ...updates } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    console.log('[PROFILE] Updating profile for:', email, 'with data:', updates);

    // Check if this is a profile completion (has name and position)
    const isCompletingProfile = updates.name && updates.position;
    if (isCompletingProfile) {
      updates.profile_complete = true;
      console.log('[PROFILE] Marking profile as complete for:', email);
    }

    let updatedUser;
    try {
      updatedUser = await prisma.user.upsert({
        where: { email: String(email) },
        create: {
          email: String(email),
          password_hash: '', // Will be set by auth system
          ...updates,
        },
        update: updates,
        select: {
          id: true,
          email: true,
          name: true,
          position: true,
          graduation_year: true,
          state: true,
          height: true,
          weight: true,
          profile_photo_url: true,
          video_links: true,
          privacy_setting: true,
          email_notifications: true,
          profile_complete: true,
          createdAt: true,
        }
      });
      console.log('[PROFILE] Profile updated successfully via Prisma for:', email, 'profile_complete:', updatedUser.profile_complete);
    } catch (dbError) {
      console.warn('[PROFILE] Database unavailable, using fallback storage:', dbError.message);
      
      // Fallback to in-memory storage
      const existing = profileFallback.get(email) || {
        id: Date.now(),
        email: email,
        name: null,
        position: null,
        graduation_year: null,
        state: null,
        height: null,
        weight: null,
        profile_photo_url: null,
        video_links: [],
        privacy_setting: 'public',
        email_notifications: true,
        profile_complete: false,
        createdAt: new Date(),
      };
      
      updatedUser = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      };
      
      profileFallback.set(email, updatedUser);
      console.log('[PROFILE] Profile updated successfully via fallback for:', email, 'profile_complete:', updatedUser.profile_complete);
    }

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Health check for profile router
router.get('/_alive', (_req, res) => res.json({ ok: true, router: 'profile' }));

module.exports = router;