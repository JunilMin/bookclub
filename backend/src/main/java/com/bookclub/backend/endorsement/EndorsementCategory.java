// ./endorsement/EndorsementCategory.java
package com.bookclub.backend.endorsement;

/**
 * Enum defining the 6 endorsement categories.
 * Each category represents a positive trait that participants can endorse.
 * All categories are worth 1 point each.
 */
public enum EndorsementCategory {
    ENGAGEMENT,        // Active participation in discussion
    COMMUNICATION,     // Clear and effective communication
    RESPECT,          // Polite and respectful behavior
    RULE_ADHERENCE,   // Following rules (hand raising, queue, timing)
    PREPARATION,      // Well prepared (read the book)
    REMATCH;          // Would like to meet again

    /**
     * Get the point value for this category.
     * All categories are worth 1 point.
     */
    public int getPoints() {
        return 1;
    }

    /**
     * Check if the given string is a valid category.
     */
    public static boolean isValid(String category) {
        if (category == null) return false;
        try {
            valueOf(category);
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
