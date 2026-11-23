package de.hangouthub.poll;

public enum VoteMode {
    /** Each user picks exactly one option and may switch to a different one later. */
    SINGLE_CHANGEABLE,
    /** Each user picks exactly one option; once cast it cannot be changed. */
    SINGLE_LOCKED,
    /** Users may vote for more than one option. */
    MULTIPLE
}
