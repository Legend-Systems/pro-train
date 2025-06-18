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

/**
 * White Labelling Configuration Interface
 * Provides comprehensive branding and customization options for dashboard appearance
 */
export interface WhiteLabelingConfig {
    // Visual Branding
    branding: {
        // Logo Configuration
        primaryLogo?: string; // Main logo URL (header, login page)
        secondaryLogo?: string; // Alternative logo URL (sidebar, compact views)
        faviconUrl?: string; // Browser favicon URL
        logoPosition?: 'left' | 'center' | 'right'; // Logo alignment in header

        // Color Scheme
        colors: {
            primary: string; // Primary brand color (#hex)
            secondary: string; // Secondary brand color (#hex)
            accent: string; // Accent color for highlights (#hex)
            background: string; // Main background color (#hex)
            surface: string; // Card/surface background (#hex)
            text: {
                primary: string; // Primary text color (#hex)
                secondary: string; // Secondary text color (#hex)
                muted: string; // Muted/disabled text color (#hex)
            };
            sidebar: {
                background: string; // Sidebar background color (#hex)
                text: string; // Sidebar text color (#hex)
                active: string; // Active menu item color (#hex)
                hover: string; // Hover state color (#hex)
            };
            header: {
                background: string; // Header background color (#hex)
                text: string; // Header text color (#hex)
                border: string; // Header border color (#hex)
            };
        };

        // Theme Configuration
        theme: {
            mode: 'light' | 'dark' | 'auto'; // Default theme mode
            allowUserToggle: boolean; // Allow users to switch themes
            roundedCorners: 'none' | 'small' | 'medium' | 'large'; // Border radius style
            fontSize: 'small' | 'medium' | 'large'; // Base font size
        };

        // Custom CSS
        customCss?: string; // Additional custom CSS for advanced styling
    };

    // Localization & Regional Settings
    localization: {
        // Language Configuration
        defaultLanguage: string; // ISO 639-1 language code (e.g., 'en', 'es', 'fr')
        supportedLanguages: string[]; // Array of supported language codes
        allowUserLanguageChange: boolean; // Allow users to change language

        // Regional Settings
        region: string; // ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB', 'DE')
        timezone: string; // IANA timezone (e.g., 'America/New_York', 'Europe/London')

        // Format Preferences
        dateFormat: string; // Date format pattern (e.g., 'MM/DD/YYYY', 'DD/MM/YYYY')
        timeFormat: '12h' | '24h'; // Time format preference
        currency: string; // ISO 4217 currency code (e.g., 'USD', 'EUR', 'GBP')
        numberFormat: {
            decimal: string; // Decimal separator ('.' or ',')
            thousands: string; // Thousands separator (',' or '.' or ' ')
        };
    };

    // Dashboard Layout & Features
    dashboard: {
        // Layout Configuration
        layout: 'sidebar' | 'topbar' | 'hybrid'; // Main navigation layout
        sidebarCollapsible: boolean; // Allow sidebar collapse
        showBreadcrumbs: boolean; // Show navigation breadcrumbs

        // Branding Display
        showOrganizationName: boolean; // Display org name in header
        showBranchName: boolean; // Display branch name in header
        organizationNamePosition: 'header' | 'sidebar' | 'both'; // Where to show org name

        // Feature Visibility
        features: {
            darkModeToggle: boolean; // Show dark mode toggle
            languageSelector: boolean; // Show language selector
            profileMenu: boolean; // Show user profile menu
            notifications: boolean; // Show notifications bell
            search: boolean; // Show global search
            help: boolean; // Show help/support links
        };

        // Custom Menu Items
        customMenuItems?: Array<{
            label: string;
            url: string;
            icon?: string;
            position: 'header' | 'sidebar' | 'footer';
            order: number;
        }>;
    };

    // Authentication & Login Customization
    authentication: {
        // Login Page Branding
        loginLogo?: string; // Logo for login page
        loginBackground?: string; // Background image/color for login
        loginWelcomeMessage?: string; // Custom welcome message

        // SSO Configuration
        ssoProviders?: Array<{
            name: string;
            displayName: string;
            logo?: string;
            buttonColor?: string;
        }>;

        // Security Branding
        showPoweredBy: boolean; // Show "Powered by TrainPro" text
        customFooterText?: string; // Custom footer text
    };
}

/**
 * Branch-Specific White Labelling Configuration Interface
 * Allows branch-level customization that inherits from organization settings
 */
export interface BranchWhiteLabelingConfig {
    // Branch-Specific Branding (inherits from organization if not specified)
    branding?: {
        // Branch Logo Override
        branchLogo?: string; // Branch-specific logo URL
        showBranchLogo: boolean; // Whether to show branch logo alongside org logo

        // Color Overrides (only specific colors can be overridden)
        colorOverrides?: {
            accent?: string; // Branch accent color
            sidebar?: {
                active?: string; // Branch-specific active menu color
            };
        };

        // Branch Theme
        customBranchCss?: string; // Branch-specific custom CSS
    };

    // Branch Localization Overrides
    localization?: {
        timezone?: string; // Branch-specific timezone override
        region?: string; // Branch-specific region override
        currency?: string; // Branch-specific currency override
    };

    // Branch Dashboard Customization
    dashboard?: {
        // Branch-Specific Features
        showBranchMetrics: boolean; // Show branch-specific metrics
        branchWelcomeMessage?: string; // Custom welcome message for branch users

        // Branch Custom Menu Items
        customMenuItems?: Array<{
            label: string;
            url: string;
            icon?: string;
            position: 'header' | 'sidebar' | 'footer';
            order: number;
            visibleToRoles: string[]; // Which roles can see this menu item
        }>;
    };
}

/**
 * Combined White Labelling Configuration
 * Merges organization and branch-specific settings
 */
export interface CombinedWhiteLabelingConfig extends WhiteLabelingConfig {
    branchOverrides?: BranchWhiteLabelingConfig;
    effectiveConfig?: WhiteLabelingConfig; // Computed final configuration
}
