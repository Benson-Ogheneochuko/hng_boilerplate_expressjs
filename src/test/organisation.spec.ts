// @ts-nocheck
import jwt from "jsonwebtoken";
import AppDataSource from "../data-source";
import { Organization, User } from "../models";
import { OrgService } from "../services";

import { Repository } from "typeorm";
import { OrgController } from "../controllers/OrgController.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { InvalidInput, ResourceNotFound } from "../middleware/error.ts";
import { validateOrgId } from "../middleware/organizationValidation.ts";
import { OrganizationRole } from "../models/organization-role.entity.ts";

jest.mock("../data-source", () => ({
  __esModule: true,
  default: {
    getRepository: jest.fn(),
    initialize: jest.fn(),
    isInitialized: false,
  },
}));

describe("Organization Controller and Middleware", () => {
  let organizationService: OrgService;
  let orgController: OrgController;
  let mockManager;
  let organizationRepositoryMock: jest.Mocked<Repository<Organization>>;
  let organizationRoleRepositoryMock: jest.Mocked<Repository<OrganizationRole>>;

  beforeEach(() => {
    jest.clearAllMocks();
    orgController = new OrgController();

    mockManager = {
      findOne: jest.fn(),
    };
    organizationRepositoryMock = {
      findOne: jest.fn(),
    } as any;
    organizationRoleRepositoryMock = {
      find: jest.fn(),
    } as any;
    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity) => {
      if (entity === Organization) return organizationRepositoryMock;
      if (entity === OrganizationRole) return organizationRoleRepositoryMock;
    });
    organizationService = new OrgService();
  });

  it("check if user is authenticated", async () => {
    const req = {
      headers: {
        authorization: "Bearer validToken",
      },
      user: undefined,
    } as unknown as Request;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    const next = jest.fn();

    jwt.verify = jest.fn().mockImplementation((token, secret, callback) => {
      callback(null, { userId: "user123" });
    });

    User.findOne = jest.fn().mockResolvedValue({
      id: "donalTrump123",
      email: "americaPresident@newyork.com",
    });

    await authMiddleware(req, res, next);

    expect(jwt.verify).toHaveBeenCalled();
    expect(User.findOne).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe("donalTrump123");
    expect(next).toHaveBeenCalled();
  });

  it("should get a single user org", async () => {
    const orgId = "1";
    const orgRes = {
      org_id: "1",
      name: "Org 1",
      description: "Org 1 description",
    };

    mockManager.findOne.mockResolvedValue(orgRes);
  });

  it("should pass valid UUID for org_id", async () => {
    const req = {
      params: { org_id: "123e4567-e89b-12d3-a456-426614174000" },
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    await validateOrgId[0](req, res, next);
    await validateOrgId[1](req, res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledWith();
  });

  it("should throw InvalidInput for empty org_id", async () => {
    const req = {
      params: { org_id: "" },
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    await validateOrgId[0](req, res, next);

    expect(() => validateOrgId[1](req, res, next)).toThrow(InvalidInput);
    expect(() => validateOrgId[1](req, res, next)).toThrow(
      "Organisation id is required",
    );
  });

  it("should throw InvalidInput for non-UUID org_id", async () => {
    const req = {
      params: { org_id: "donald-trump-for-president" },
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    await validateOrgId[0](req, res, next);

    expect(() => validateOrgId[1](req, res, next)).toThrow(InvalidInput);
    expect(() => validateOrgId[1](req, res, next)).toThrow(
      "Valid org_id must be provided",
    );
  });

  describe("fetchAllRolesInOrganization", () => {
    it("should fetch all roles for an existing organization", async () => {
      const organizationId = "org123";
      const mockOrganization = { id: organizationId, name: "Test Org" };
      const mockRoles = [
        { id: "role1", name: "Admin", description: "Administrator" },
        { id: "role2", name: "User", description: "Regular User" },
      ];

      organizationRepositoryMock.findOne.mockResolvedValue(mockOrganization);
      organizationRoleRepositoryMock.find.mockResolvedValue(mockRoles);

      const result =
        await organizationService.fetchAllRolesInOrganization(organizationId);

      expect(result).toEqual(mockRoles);
      expect(organizationRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: organizationId },
      });
      expect(organizationRoleRepositoryMock.find).toHaveBeenCalledWith({
        where: { organization: { id: organizationId } },
        select: ["id", "name", "description"],
      });
    });

    it("should throw ResourceNotFound for non-existent organization", async () => {
      const organizationId = "nonexistent123";

      organizationRepositoryMock.findOne.mockResolvedValue(null);

      try {
        await organizationService.fetchAllRolesInOrganization(organizationId);
        fail("Expected ResourceNotFound to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ResourceNotFound);
      }

      expect(organizationRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: organizationId },
      });
      expect(organizationRoleRepositoryMock.find).not.toHaveBeenCalled();
    });

    it("should return an empty array when organization has no roles", async () => {
      const organizationId = "org456";
      const mockOrganization = { id: organizationId, name: "Test Org" };

      organizationRepositoryMock.findOne.mockResolvedValue(mockOrganization);
      organizationRoleRepositoryMock.find.mockResolvedValue([]);

      const result =
        await organizationService.fetchAllRolesInOrganization(organizationId);

      expect(result).toEqual([]);
      expect(organizationRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: organizationId },
      });
      expect(organizationRoleRepositoryMock.find).toHaveBeenCalledWith({
        where: { organization: { id: organizationId } },
        select: ["id", "name", "description"],
      });
    });
  });
});
