export interface OrganizationStats {
    totalBranches: number;
    activeBranches: number;
    inactiveBranches: number;
}

export interface OrganizationWithStats {
    organization: any; // Will be Organization entity
    stats: OrganizationStats;
}

export interface BranchFilters {
    organizationId?: string;
    isActive?: boolean;
    managerName?: string;
}

export interface OrganizationFilters {
    isActive?: boolean;
    name?: string;
} 