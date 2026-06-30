import { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { UserService } from '../user/user.service';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

// The controller composes ProfileService (measurements) with UserService (birthday,
// which lives on iam.User). These unit tests prove the merge + the conditional
// birthday write — both new with the birthday feature.
describe('ProfileController', () => {
  let profiles: { getByUserId: jest.Mock; update: jest.Mock };
  let users: { findById: jest.Mock; setBirthday: jest.Mock };
  let controller: ProfileController;
  const caller = { id: 'u1' } as unknown as AuthenticatedUser;

  beforeEach(() => {
    profiles = { getByUserId: jest.fn(), update: jest.fn() };
    users = { findById: jest.fn(), setBirthday: jest.fn() };
    controller = new ProfileController(
      profiles as unknown as ProfileService,
      users as unknown as UserService,
    );
  });

  it('GET merges measurements (Profile) with birthday (User)', async () => {
    const bday = new Date('1995-06-15T00:00:00.000Z');
    profiles.getByUserId.mockResolvedValue({
      heightCm: 175,
      weightKg: 68,
      measurements: { chest: 96 },
    });
    users.findById.mockResolvedValue({ id: 'u1', birthday: bday });

    await expect(controller.get(caller)).resolves.toEqual({
      heightCm: 175,
      weightKg: 68,
      measurements: { chest: 96 },
      birthday: bday,
    });
  });

  it('GET returns all-null when there is no profile and no birthday', async () => {
    profiles.getByUserId.mockResolvedValue(null);
    users.findById.mockResolvedValue({ id: 'u1', birthday: null });

    await expect(controller.get(caller)).resolves.toEqual({
      heightCm: null,
      weightKg: null,
      measurements: null,
      birthday: null,
    });
  });

  it('PATCH writes measurements + birthday when a birthday is provided', async () => {
    const bday = new Date('1995-06-15T00:00:00.000Z');
    profiles.update.mockResolvedValue({});
    profiles.getByUserId.mockResolvedValue({
      heightCm: 170,
      weightKg: null,
      measurements: null,
    });
    users.findById.mockResolvedValue({ id: 'u1', birthday: bday });

    await controller.update(caller, { heightCm: 170, birthday: bday });

    expect(profiles.update).toHaveBeenCalledWith('u1', {
      heightCm: 170,
      birthday: bday,
    });
    expect(users.setBirthday).toHaveBeenCalledWith('u1', bday);
  });

  it('PATCH leaves the birthday untouched when it is omitted', async () => {
    profiles.update.mockResolvedValue({});
    profiles.getByUserId.mockResolvedValue(null);
    users.findById.mockResolvedValue({ id: 'u1', birthday: null });

    await controller.update(caller, { heightCm: 170 });

    expect(users.setBirthday).not.toHaveBeenCalled();
  });
});
