/**
 * Social slice with squad and challenge management
 * Addresses Requirements: 2.2, 5.1, 5.2, 5.3, 6.2, 7.4, 8.2, 9.1
 */

import { SocialSlice, Squad, Challenge, User, SquadMember } from '../types';
import { createNormalizedState, updateNormalizedState } from '../utils/entityManager';
import { createEventEmitter, createEventListener, STORE_EVENTS } from '../utils/eventBus';
import { generateId, generateShortId } from '../utils/idGenerator';

// Mock data for squads
const mockSquads: Squad[] = [
  {
    id: 'squad-1',
    name: 'Focus Warriors',
    description: 'A group dedicated to building focus habits together',
    icon: '⚔️',
    isPrivate: false,
    inviteCode: 'FOCUS123',
    ownerId: 'user-1',
    members: {
      'user-1': {
        userId: 'user-1',
        joinedAt: new Date('2024-01-01'),
        role: 'owner',
        stats: {
          totalFocusTime: 3600,
          weeklyFocusTime: 900,
          currentStreak: 5,
        },
      },
      'user-2': {
        userId: 'user-2',
        joinedAt: new Date('2024-01-02'),
        role: 'member',
        stats: {
          totalFocusTime: 2400,
          weeklyFocusTime: 600,
          currentStreak: 3,
        },
      },
    },
    memberIds: ['user-1', 'user-2'],
    maxMembers: 10,
    stats: {
      totalFocusTime: 6000,
      totalSessions: 120,
      averageSessionLength: 25,
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  },
];

// Mock data for challenges
const mockChallenges: Challenge[] = [
  {
    id: 'challenge-1',
    title: '7-Day Focus Challenge',
    description: 'Complete at least 25 minutes of focused work each day for 7 days',
    type: 'individual',
    targetType: 'streak',
    targetValue: 7,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-07'),
    participants: ['user-1'],
    rewards: {
      seeds: 100,
      badges: ['focus-master'],
    },
    status: 'active',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'challenge-2',
    title: 'Squad Focus Marathon',
    description: 'Collectively achieve 1000 minutes of focus time as a squad',
    type: 'squad',
    targetType: 'duration',
    targetValue: 60000, // 1000 minutes in seconds
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-14'),
    participants: ['squad-1'],
    rewards: {
      seeds: 200,
      badges: ['team-player'],
    },
    status: 'active',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

export function createSocialSlice(set: any, get: any, api: any): SocialSlice {
  const eventEmitter = createEventEmitter('social');
  const eventListener = createEventListener();

  // Listen for focus session completions to update squad stats
  eventListener.on(STORE_EVENTS.FOCUS_SESSION_COMPLETED, (event) => {
    const { duration, sessionId } = event.payload;
    const userId = get().auth.user?.id;
    
    if (userId) {
      // Update user's stats in all squads they belong to
      const userSquads = get().social.getUserSquads();
      userSquads.forEach((squad: Squad) => {
        if (squad.members[userId]) {
          set((state: any) => {
            state.social.squads = updateNormalizedState(
              state.social.squads,
              (manager) => {
                const updatedSquad = { ...squad };
                updatedSquad.members[userId].stats.totalFocusTime += duration;
                updatedSquad.members[userId].stats.weeklyFocusTime += duration;
                updatedSquad.stats.totalFocusTime += duration;
                updatedSquad.stats.totalSessions += 1;
                updatedSquad.updatedAt = new Date();
                manager.update(squad.id, updatedSquad);
              }
            );
          });
        }
      });
    }
  });

  return {
    // State
    squads: createNormalizedState<Squad>(mockSquads),
    challenges: createNormalizedState<Challenge>(mockChallenges),
    friends: createNormalizedState<User>(),
    
    // Current User's Social Data
    userSquads: ['squad-1'], // Mock user is in squad-1
    activeChallenges: ['challenge-1', 'challenge-2'],
    
    // Actions
    joinSquad: async (squadId: string) => {
      const squad = get().social.squads.byId[squadId];
      const userId = get().auth.user?.id;
      
      if (!squad) {
        throw new Error(`Squad with ID ${squadId} not found`);
      }
      
      if (!userId) {
        throw new Error('User must be logged in to join a squad');
      }
      
      if (squad.members[userId]) {
        throw new Error('User is already a member of this squad');
      }
      
      if (squad.memberIds.length >= squad.maxMembers) {
        throw new Error('Squad is at maximum capacity');
      }

      set((state: any) => {
        // Add user to squad
        const newMember: SquadMember = {
          userId,
          joinedAt: new Date(),
          role: 'member',
          stats: {
            totalFocusTime: 0,
            weeklyFocusTime: 0,
            currentStreak: 0,
          },
        };

        state.social.squads = updateNormalizedState(
          state.social.squads,
          (manager) => {
            const updatedSquad = { ...squad };
            updatedSquad.members[userId] = newMember;
            updatedSquad.memberIds.push(userId);
            updatedSquad.updatedAt = new Date();
            manager.update(squadId, updatedSquad);
          }
        );

        // Add squad to user's squads
        if (!state.social.userSquads.includes(squadId)) {
          state.social.userSquads.push(squadId);
        }
      });

      // Emit event
      eventEmitter.emit(STORE_EVENTS.SQUAD_JOINED, {
        squadId,
        userId,
        squadName: squad.name,
      });
    },

    leaveSquad: async (squadId: string) => {
      const squad = get().social.squads.byId[squadId];
      const userId = get().auth.user?.id;
      
      if (!squad) {
        throw new Error(`Squad with ID ${squadId} not found`);
      }
      
      if (!userId) {
        throw new Error('User must be logged in to leave a squad');
      }
      
      if (!squad.members[userId]) {
        throw new Error('User is not a member of this squad');
      }
      
      if (squad.ownerId === userId) {
        throw new Error('Squad owner cannot leave the squad. Transfer ownership first.');
      }

      set((state: any) => {
        // Remove user from squad
        state.social.squads = updateNormalizedState(
          state.social.squads,
          (manager) => {
            const updatedSquad = { ...squad };
            delete updatedSquad.members[userId];
            updatedSquad.memberIds = updatedSquad.memberIds.filter((id: string) => id !== userId);
            updatedSquad.updatedAt = new Date();
            manager.update(squadId, updatedSquad);
          }
        );

        // Remove squad from user's squads
        state.social.userSquads = state.social.userSquads.filter((id: string) => id !== squadId);
      });

      // Emit event
      eventEmitter.emit(STORE_EVENTS.SQUAD_LEFT, {
        squadId,
        userId,
        squadName: squad.name,
      });
    },

    createChallenge: async (challengeData: Omit<Challenge, 'id' | 'createdAt' | 'updatedAt' | 'participants'>) => {
      const userId = get().auth.user?.id;
      
      if (!userId) {
        throw new Error('User must be logged in to create a challenge');
      }

      const challenge: Challenge = {
        ...challengeData,
        id: generateId(),
        participants: challengeData.type === 'individual' ? [userId] : [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      set((state: any) => {
        // Add challenge
        state.social.challenges = updateNormalizedState(
          state.social.challenges,
          (manager) => manager.add(challenge)
        );

        // Add to user's active challenges if individual
        if (challenge.type === 'individual') {
          state.social.activeChallenges.push(challenge.id);
        }
      });

      // Don't return the challenge, just complete the promise
    },

    joinChallenge: async (challengeId: string) => {
      const challenge = get().social.challenges.byId[challengeId];
      const userId = get().auth.user?.id;
      
      if (!challenge) {
        throw new Error(`Challenge with ID ${challengeId} not found`);
      }
      
      if (!userId) {
        throw new Error('User must be logged in to join a challenge');
      }
      
      if (challenge.participants.includes(userId)) {
        throw new Error('User is already participating in this challenge');
      }
      
      if (challenge.status !== 'active' && challenge.status !== 'upcoming') {
        throw new Error('Cannot join a completed or cancelled challenge');
      }

      set((state: any) => {
        // Add user to challenge participants
        state.social.challenges = updateNormalizedState(
          state.social.challenges,
          (manager) => {
            const updatedChallenge = { ...challenge };
            updatedChallenge.participants.push(userId);
            updatedChallenge.updatedAt = new Date();
            manager.update(challengeId, updatedChallenge);
          }
        );

        // Add to user's active challenges
        if (!state.social.activeChallenges.includes(challengeId)) {
          state.social.activeChallenges.push(challengeId);
        }
      });

      // Emit event
      eventEmitter.emit(STORE_EVENTS.CHALLENGE_JOINED, {
        challengeId,
        userId,
        challengeTitle: challenge.title,
      });
    },
    
    // Selectors
    getUserSquads: () => {
      const state = get().social;
      return state.userSquads
        .map((squadId: string) => state.squads.byId[squadId])
        .filter(Boolean);
    },
    
    getActiveChallenges: () => {
      const state = get().social;
      return state.activeChallenges
        .map((challengeId: string) => state.challenges.byId[challengeId])
        .filter(Boolean)
        .filter((challenge: Challenge) => challenge.status === 'active' || challenge.status === 'upcoming');
    },
    
    getSquadLeaderboard: (squadId: string) => {
      const squad = get().social.squads.byId[squadId];
      if (!squad) return [];
      
      return (Object.values(squad.members) as SquadMember[])
        .sort((a: SquadMember, b: SquadMember) => b.stats.weeklyFocusTime - a.stats.weeklyFocusTime);
    },
  };
}