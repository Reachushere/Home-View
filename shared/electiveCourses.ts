export interface ElectiveCourse {
  code: string;
  name: string;
  level: 'LOWER' | 'UPPER' | 'BOTH';
  category: string;
  prereq?: boolean;
  antireq?: string;
  semesters: {
    fall2025?: string;
    winter2026?: string;
    spring2026?: string;
    summer2026?: string;
  };
}

export const LIBERAL_STUDIES_COURSES: ElectiveCourse[] = [
  // ARABIC
  { code: 'CARB 101', name: 'Introductory Arabic I', level: 'LOWER', category: 'Arabic', semesters: { fall2025: 'T: Virtual', spring2026: 'MW: Virtual' } },
  { code: 'CARB 201', name: 'Introductory Arabic II', level: 'LOWER', category: 'Arabic', prereq: true, semesters: { fall2025: 'M: Virtual', winter2026: 'M: Virtual', spring2026: 'TR: Virtual' } },
  { code: 'CARB 401', name: 'Intermediate Arabic II', level: 'UPPER', category: 'Arabic', prereq: true, semesters: { fall2025: 'W: Virtual', winter2026: 'W: Virtual' } },
  { code: 'CARB 501', name: 'Advanced Arabic I', level: 'UPPER', category: 'Arabic', prereq: true, semesters: { fall2025: 'R: Virtual', spring2026: 'TR: In-person' } },
  { code: 'CARB 601', name: 'Advanced Arabic II', level: 'UPPER', category: 'Arabic', prereq: true, semesters: { winter2026: 'R: Virtual', summer2026: 'TR: Virtual' } },

  // AMERICAN SIGN LANGUAGE
  { code: 'CASL 101', name: 'Introductory American Sign Language I', level: 'LOWER', category: 'ASL', semesters: { fall2025: 'M/T/W/R: Virtual', spring2026: 'MW/TR: Virtual', summer2026: 'MW/TR: Virtual' } },
  { code: 'CASL 201', name: 'Introductory American Sign Language II', level: 'LOWER', category: 'ASL', prereq: true, semesters: { fall2025: 'M: Virtual', summer2026: 'MW: Virtual' } },
  { code: 'CASL 301', name: 'Intermediate American Sign Language I', level: 'UPPER', category: 'ASL', prereq: true, semesters: { spring2026: 'MW: Virtual' } },

  // BIOLOGY
  { code: 'BMS 150', name: 'Introduction to the Human Genome', level: 'LOWER', category: 'Biology', semesters: { spring2026: 'MW: Virtual' } },
  { code: 'CBLG 599', name: 'Biology Facts in Pop Media Sci-Fiction', level: 'UPPER', category: 'Biology', semesters: { spring2026: 'TR: Virtual' } },
  { code: 'CBLG 655', name: 'Viruses Among Us', level: 'UPPER', category: 'Biology', semesters: { fall2025: 'T: Virtual', winter2026: 'M: Virtual', spring2026: 'MW: Virtual' } },
  { code: 'CBLG 699', name: 'Social Factors in Drug Development', level: 'UPPER', category: 'Biology', semesters: { spring2026: 'TR: Virtual' } },
  { code: 'CBLG 850', name: 'What is Cancer?', level: 'UPPER', category: 'Biology', semesters: { fall2025: 'M/W/R: Virtual', winter2026: 'M/T/R: Virtual', spring2026: 'TR: Virtual', summer2026: 'TR: Virtual' } },

  // CARIBBEAN STUDIES
  { code: 'CCRB 100', name: 'Introduction to the Caribbean', level: 'LOWER', category: 'Caribbean Studies', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CCRB 500', name: 'Families in the Caribbean', level: 'UPPER', category: 'Caribbean Studies', semesters: { winter2026: 'T: Virtual' } },
  { code: 'CCRB 501', name: 'Racism and Caribbean Peoples in Canada', level: 'UPPER', category: 'Caribbean Studies', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CCRB 502', name: 'Cultural Traditions in the Caribbean', level: 'UPPER', category: 'Caribbean Studies', semesters: { spring2026: 'Online' } },

  // CHEMISTRY
  { code: 'CCHY 183', name: 'Introduction to Forensic Science', level: 'LOWER', category: 'Chemistry', semesters: { fall2025: 'M: Virtual', winter2026: 'T: Virtual', spring2026: 'MW/TR: Virtual' } },
  { code: 'CCHY 583', name: 'Alternative Energies', level: 'UPPER', category: 'Chemistry', semesters: { fall2025: 'M/T: Virtual', winter2026: 'T/W: Virtual', spring2026: 'MW/TR: Virtual', summer2026: 'MW/TR: Virtual' } },
  { code: 'CCHY 599', name: 'The Business of Chemistry and Biology', level: 'UPPER', category: 'Chemistry', semesters: { fall2025: 'M/T: Virtual', spring2026: 'MW/TR: Virtual', summer2026: 'MW: Virtual' } },

  // CHINESE
  { code: 'CCHN 101', name: 'Introductory Chinese I', level: 'LOWER', category: 'Chinese', semesters: { fall2025: 'W: Virtual', winter2026: 'W: Virtual', spring2026: 'MW: Virtual' } },
  { code: 'CCHN 201', name: 'Introductory Chinese II', level: 'LOWER', category: 'Chinese', prereq: true, semesters: { summer2026: 'MW: Virtual' } },
  { code: 'CCHN 301', name: 'Intermediate Chinese I', level: 'UPPER', category: 'Chinese', prereq: true, semesters: { winter2026: 'T: Virtual' } },

  // CRIMINOLOGY
  { code: 'CCRM 101', name: 'Understanding Crime in Canada', level: 'LOWER', category: 'Criminology', semesters: { fall2025: 'W: Virtual', spring2026: 'MW: Virtual' } },
  { code: 'CRM 601', name: 'Violence and Society', level: 'UPPER', category: 'Criminology', semesters: { spring2026: 'TR: Virtual', winter2026: 'T/W: Virtual', summer2026: 'MW: Virtual' } },

  // ECONOMICS
  { code: 'CECN 210', name: 'Understanding Economics', level: 'LOWER', category: 'Economics', antireq: 'ECN104, ECN204', semesters: { fall2025: 'Online', winter2026: 'Online' } },
  { code: 'CECN 340', name: 'The Economics of Human Behavior', level: 'LOWER', category: 'Economics', semesters: { winter2026: 'R: Virtual', spring2026: 'Online', summer2026: 'Online' } },
  { code: 'CECN 503', name: 'Economic Development', level: 'UPPER', category: 'Economics', antireq: 'ECN726', semesters: { fall2025: 'M: Virtual', winter2026: 'M: Virtual', spring2026: 'MW: Virtual' } },
  { code: 'CECN 511', name: 'Economy and the Environment', level: 'UPPER', category: 'Economics', antireq: 'ECN510', semesters: { spring2026: 'MW: Virtual', summer2026: 'MW: Virtual' } },
  { code: 'CECN 512', name: 'Economics of Sex', level: 'UPPER', category: 'Economics', semesters: { fall2025: 'R: Virtual', winter2026: 'R: Virtual', spring2026: 'MW: Virtual' } },
  { code: 'CECN 603', name: 'Economic Issues in Globalization', level: 'UPPER', category: 'Economics', semesters: { spring2026: 'TR: Virtual' } },
  { code: 'CECN 722', name: 'Economic Issues in Professional Sports', level: 'UPPER', category: 'Economics', semesters: { fall2025: 'T: Virtual', winter2026: 'W: Virtual', summer2026: 'TR: Virtual' } },

  // ENGLISH
  { code: 'CENG 101', name: 'Laughter and Tears: Comedy and Tragedy', level: 'LOWER', category: 'English', semesters: { fall2025: 'R: Virtual', winter2026: 'W/R: Virtual', spring2026: 'MW: Virtual' } },
  { code: 'CENG 104', name: 'The Short Story', level: 'LOWER', category: 'English', semesters: { fall2025: 'W: Virtual', winter2026: 'M: Virtual', spring2026: 'TR: Virtual' } },
  { code: 'CENG 112', name: 'Zap, Pow, Bang: Pop Literature', level: 'LOWER', category: 'English', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CENG 203', name: 'The Literature of Indigenous Peoples', level: 'LOWER', category: 'English', semesters: { fall2025: 'W: Virtual', spring2026: 'TR: Virtual' } },
  { code: 'CENG 212', name: 'Cultures in Crisis', level: 'LOWER', category: 'English', semesters: { spring2026: 'TR: Virtual' } },
  { code: 'CENG 201', name: 'Myth and Literature', level: 'LOWER', category: 'English', semesters: { summer2026: 'MW: Virtual' } },
  { code: 'CENG 503', name: 'Science Fiction', level: 'UPPER', category: 'English', semesters: { spring2026: 'MW: Virtual' } },
  { code: 'CENG 505', name: 'Creative Writing', level: 'UPPER', category: 'English', semesters: { fall2025: 'M/R: Virtual', winter2026: 'M/W: Virtual', spring2026: 'MW/TR: Virtual', summer2026: 'MW/TR: Virtual' } },
  { code: 'CENG 510', name: 'Gothic Horror', level: 'UPPER', category: 'English', semesters: { winter2026: 'W: Virtual', spring2026: 'TR: Virtual' } },
  { code: 'CENG 511', name: 'The Art of Writing Life', level: 'UPPER', category: 'English', semesters: { fall2025: 'M: Virtual' } },
  { code: 'CENG 602', name: "Women's Writing", level: 'UPPER', category: 'English', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },

  // FRENCH
  { code: 'CFRE 101', name: 'Introductory French I', level: 'LOWER', category: 'French', semesters: { spring2026: 'TR: Virtual', summer2026: 'TR: Virtual' } },
  { code: 'CFRE 201', name: 'Introductory French II', level: 'LOWER', category: 'French', prereq: true, semesters: { summer2026: 'MW: Virtual' } },
  { code: 'CFRE 301', name: 'Intermediate French I', level: 'UPPER', category: 'French', prereq: true, semesters: { spring2026: 'MW/TR: Virtual' } },
  { code: 'CFRE 302', name: 'French Food, Wine and Hospitality', level: 'UPPER', category: 'French', semesters: { spring2026: 'TR: Virtual' } },
  { code: 'CFRE 401', name: 'Intermediate French II', level: 'UPPER', category: 'French', prereq: true, semesters: { summer2026: 'TR: Virtual' } },
  { code: 'CFRE 501', name: 'Speaking and Writing French', level: 'UPPER', category: 'French', prereq: true, semesters: { spring2026: 'MW: Virtual' } },

  // GEOGRAPHY
  { code: 'CGEO 106', name: 'Geography of Everyday Life', level: 'LOWER', category: 'Geography', semesters: { fall2025: 'M: Virtual', winter2026: 'T/W: Virtual', spring2026: 'W/T: Virtual' } },
  { code: 'CGEO 108', name: 'Geography of the Global Village', level: 'LOWER', category: 'Geography', semesters: { fall2025: 'M: Virtual', winter2026: 'M: Virtual', spring2026: 'R: Virtual' } },
  { code: 'CGEO 110', name: 'The Physical Environment', level: 'LOWER', category: 'Geography', semesters: { fall2025: 'M/T/R: Virtual', winter2026: 'M/W/R: Virtual', spring2026: 'T/W/R: Virtual' } },
  { code: 'CGEO 208', name: 'Geography of the Global Economy', level: 'LOWER', category: 'Geography', semesters: { winter2026: 'T/R: Virtual' } },
  { code: 'CGEO 605', name: 'The Geography of the Canadian North', level: 'UPPER', category: 'Geography', semesters: { fall2025: 'T: Virtual', winter2026: 'T: Virtual' } },
  { code: 'CGEO 702', name: 'Technology and the Contemporary Environment', level: 'UPPER', category: 'Geography', semesters: { fall2025: 'T/W/R: Virtual', winter2026: 'T/W/R: Virtual', spring2026: 'T/W/MW: Virtual' } },
  { code: 'CGEO 793', name: 'The Geography of Toronto', level: 'UPPER', category: 'Geography', semesters: { fall2025: 'M/T/W: Virtual', winter2026: 'M/T/W/R: Virtual', spring2026: 'T/M/W/R: Virtual' } },
  { code: 'CGEO 802', name: 'The Geography of Recreation', level: 'UPPER', category: 'Geography', semesters: { spring2026: 'MW: Virtual' } },
  { code: 'CGEO 820', name: 'The Outer Landscape of Culture', level: 'UPPER', category: 'Geography', semesters: { fall2025: 'W: Virtual', spring2026: 'W: Virtual' } },

  // HISTORY
  { code: 'CHST 118', name: 'The City in History', level: 'LOWER', category: 'History', semesters: { winter2026: 'W: Virtual', spring2026: 'TR: Virtual' } },
  { code: 'CHST 119', name: 'Rise of Empires: History Through Film', level: 'LOWER', category: 'History', semesters: { spring2026: 'TR: Virtual' } },
  { code: 'CHST 207', name: 'Introduction to Ancient Greece and Rome', level: 'LOWER', category: 'History', semesters: { fall2025: 'M: Virtual', spring2026: 'MW: Virtual' } },
  { code: 'CHST 219', name: 'Decolonization: History Through Film', level: 'LOWER', category: 'History', semesters: { summer2026: 'MW: Virtual' } },
  { code: 'CHST 222', name: 'The History of the Caribbean', level: 'LOWER', category: 'History', semesters: { spring2026: 'Online' } },
  { code: 'CHST 501', name: 'The American Civil War', level: 'UPPER', category: 'History', semesters: { summer2026: 'MW: Virtual' } },
  { code: 'CHST 503', name: 'Crime and Punishment in Modern Canada', level: 'UPPER', category: 'History', semesters: { fall2025: 'Online', spring2026: 'Online' } },
  { code: 'CHST 506', name: 'The Ancient Egyptian World', level: 'UPPER', category: 'History', semesters: { winter2026: 'R: Virtual', summer2026: 'TR: Virtual' } },
  { code: 'CHST 527', name: 'Toronto: Wilderness to Metropolis', level: 'UPPER', category: 'History', semesters: { fall2025: 'W: Virtual' } },
  { code: 'CHST 533', name: 'Africa Before 1850', level: 'UPPER', category: 'History', semesters: { spring2026: 'Online' } },
  { code: 'CHST 602', name: 'Propaganda', level: 'UPPER', category: 'History', semesters: { fall2025: 'R: Virtual', winter2026: 'M: Virtual', spring2026: 'Online' } },
  { code: 'CHST 603', name: 'The Third Reich', level: 'UPPER', category: 'History', semesters: { spring2026: 'MW: Virtual' } },
  { code: 'CHST 604', name: 'The Uneasy Peace: The Cold War', level: 'UPPER', category: 'History', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CHST 633', name: 'Modern Africa', level: 'UPPER', category: 'History', semesters: { spring2026: 'Online' } },
  { code: 'CHST 658', name: 'Sex in the City', level: 'UPPER', category: 'History', semesters: { fall2025: 'M: Virtual', summer2026: 'TR: Virtual' } },
  { code: 'CHST 701', name: 'Scientific Technology and Society', level: 'UPPER', category: 'History', semesters: { summer2026: 'MW: Virtual' } },
  { code: 'CHST 702', name: 'First World War', level: 'UPPER', category: 'History', semesters: { spring2026: 'MW: Virtual' } },
  { code: 'CHST 711', name: 'Canada and the United States', level: 'UPPER', category: 'History', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CHST 787', name: 'Astronomy vs Astrology', level: 'UPPER', category: 'History', semesters: { fall2025: 'T: Virtual', spring2026: 'MW: Virtual' } },
  { code: 'CHST 802', name: 'Second World War', level: 'UPPER', category: 'History', semesters: { summer2026: 'MW: Virtual' } },
  { code: 'CHST 811', name: 'The Holocaust', level: 'UPPER', category: 'History', semesters: { summer2026: 'TR: Virtual' } },

  // INTERIOR DESIGN / ART
  { code: 'CIRL 100', name: 'Introduction to World Art I: Pictorial Arts', level: 'LOWER', category: 'Art', semesters: { fall2025: 'W: Virtual' } },
  { code: 'CIRL 500', name: 'Modern and Contemporary Art, Design', level: 'UPPER', category: 'Art', semesters: { spring2026: 'T: Virtual' } },

  // MUSIC
  { code: 'CMUS 101', name: 'Intro to World and Early European Music', level: 'LOWER', category: 'Music', semesters: { winter2026: 'Online' } },
  { code: 'CMUS 106', name: 'The Architecture of Music', level: 'LOWER', category: 'Music', semesters: { spring2026: 'MW: Virtual' } },
  { code: 'CMUS 201', name: 'Introduction to Classical Music', level: 'LOWER', category: 'Music', semesters: { fall2025: 'T: Virtual', spring2026: 'TR: Virtual' } },
  { code: 'CMUS 220', name: 'Global Popular Music', level: 'LOWER', category: 'Music', semesters: { winter2026: 'R: Virtual' } },
  { code: 'CMUS 501', name: 'Music of World Cultures', level: 'UPPER', category: 'Music', semesters: { fall2025: 'W: Virtual' } },
  { code: 'CMUS 503', name: 'Social Issues in Popular Music', level: 'UPPER', category: 'Music', semesters: { winter2026: 'TBA: Virtual', spring2026: 'TBA: Virtual' } },
  { code: 'CMUS 505', name: 'The History of Pop Music', level: 'UPPER', category: 'Music', semesters: { winter2026: 'M/T: Virtual', spring2026: 'MW: Virtual', summer2026: 'MW/TR: Virtual' } },
  { code: 'CMUS 520', name: 'Women in Popular Music', level: 'UPPER', category: 'Music', semesters: { spring2026: 'TR: Virtual' } },

  // PHILOSOPHY
  { code: 'CPHL 101', name: 'Plato and the Roots of Western Philosophy', level: 'LOWER', category: 'Philosophy', semesters: { fall2025: 'T: Virtual', spring2026: 'MW: Virtual' } },
  { code: 'CPHL 110', name: 'Philosophy of Religion', level: 'LOWER', category: 'Philosophy', semesters: { fall2025: 'R: Virtual', winter2026: 'T: Virtual', spring2026: 'TR: Virtual' } },
  { code: 'CPHL 187', name: 'Ancient Greek Philosophy', level: 'LOWER', category: 'Philosophy', semesters: { summer2026: 'TR: Virtual' } },
  { code: 'CPHL 201', name: 'Problems in Philosophy', level: 'LOWER', category: 'Philosophy', semesters: { fall2025: 'T: Virtual', winter2026: 'M: Virtual', summer2026: 'TR: Virtual' } },
  { code: 'CPHL 214', name: 'Critical Thinking', level: 'LOWER', category: 'Philosophy', antireq: 'SSH105', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CPHL 306', name: 'Freedom, Equality, Limits of Authority', level: 'LOWER', category: 'Philosophy', semesters: { fall2025: 'W: Virtual', spring2026: 'TR: Virtual', summer2026: 'MW: Virtual' } },
  { code: 'CPHL 333', name: 'Philosophy of Human Nature', level: 'LOWER', category: 'Philosophy', semesters: { fall2025: 'M: Virtual', winter2026: 'W: Virtual' } },
  { code: 'CPHL 366', name: 'Existentialism and Art and Culture', level: 'LOWER', category: 'Philosophy', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'MW: Virtual' } },
  { code: 'CPHL 406', name: 'Issues of Life, Death and Poverty', level: 'LOWER', category: 'Philosophy', semesters: { winter2026: 'M: Virtual', summer2026: 'TR: Virtual' } },
  { code: 'CPHL 500', name: 'Philosophy of the Natural Environment', level: 'UPPER', category: 'Philosophy', semesters: { summer2026: 'TR: Virtual' } },
  { code: 'CPHL 504', name: 'Philosophy of Art', level: 'UPPER', category: 'Philosophy', semesters: { winter2026: 'R: Virtual', spring2026: 'MW: Virtual' } },
  { code: 'CPHL 509', name: 'Bioethics', level: 'UPPER', category: 'Philosophy', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CPHL 550', name: 'Knowledge, Truth and Belief', level: 'UPPER', category: 'Philosophy', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CPHL 551', name: 'Metaphysics', level: 'UPPER', category: 'Philosophy', semesters: { fall2025: 'R: Virtual', summer2026: 'MW: Virtual' } },
  { code: 'CPHL 603', name: 'The Nature of Ethics', level: 'UPPER', category: 'Philosophy', semesters: { spring2026: 'TR: Virtual' } },
  { code: 'CPHL 605', name: 'Existentialism', level: 'UPPER', category: 'Philosophy', semesters: { spring2026: 'TR: Virtual' } },
  { code: 'CPHL 606', name: 'Philosophy of Love and Sex', level: 'UPPER', category: 'Philosophy', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CPHL 611', name: 'Philosophy of Mind', level: 'UPPER', category: 'Philosophy', semesters: { fall2025: 'W: Virtual' } },
  { code: 'CPHL 612', name: 'Philosophy of Law', level: 'UPPER', category: 'Philosophy', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CPHL 708', name: 'Early Modern Philosophy', level: 'UPPER', category: 'Philosophy', semesters: { winter2026: 'W: Virtual' } },
  { code: 'CPHL 710', name: 'Philosophy and Film', level: 'UPPER', category: 'Philosophy', semesters: { winter2026: 'T: Virtual', spring2026: 'TR: Virtual' } },

  // PHYSICS
  { code: 'CPCS 181', name: 'Introduction to Astronomy', level: 'LOWER', category: 'Physics', semesters: { fall2025: 'M/T/W/F/SAT: Virtual', winter2026: 'M/T/R/F: Virtual', spring2026: 'MW: Virtual', summer2026: 'MW/TR: Virtual' } },
  { code: 'CPCS 182', name: 'Life in the Milky Way Galaxy', level: 'LOWER', category: 'Physics', semesters: { fall2025: 'M: Virtual', winter2026: 'F: TBA' } },
  { code: 'CPCS 581', name: 'Advanced Topics in Astronomy', level: 'UPPER', category: 'Physics', semesters: { fall2025: 'M/F: Virtual', winter2026: 'W: Virtual' } },

  // PSYCHOLOGY (Liberal)
  { code: 'CPSY 105', name: 'Perspectives in Psychology', level: 'LOWER', category: 'Psychology', antireq: 'PSY102', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CPSY 308', name: 'Psychology of Thinking', level: 'LOWER', category: 'Psychology', antireq: 'PSY108', semesters: { winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CPSY 504', name: 'Social Psychology', level: 'UPPER', category: 'Psychology', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online' } },
  { code: 'CPSY 505', name: 'Personality Theory', level: 'UPPER', category: 'Psychology', prereq: true, semesters: { spring2026: 'Online' } },
  { code: 'CPSY 606', name: 'Abnormal Psychology', level: 'UPPER', category: 'Psychology', prereq: true, semesters: { winter2026: 'T: Virtual', spring2026: 'TR: Virtual' } },
  { code: 'CPSY 607', name: 'Drugs and Human Behaviour', level: 'UPPER', category: 'Psychology', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CPSY 614', name: 'Psychology of Sport', level: 'UPPER', category: 'Psychology', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CPSY 621', name: 'Psychology of Human Sexuality', level: 'UPPER', category: 'Psychology', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CPSY 706', name: 'Positive Psychology', level: 'UPPER', category: 'Psychology', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CPSY 707', name: 'Models of Stress and Adaptation', level: 'UPPER', category: 'Psychology', prereq: true, semesters: { fall2025: 'Online', spring2026: 'Online' } },
  { code: 'CPSY 807', name: 'Psychology of Prejudice', level: 'UPPER', category: 'Psychology', prereq: true, semesters: { fall2025: 'R: Virtual' } },

  // MEDIA
  { code: 'CRTA 180', name: 'Music and Film', level: 'LOWER', category: 'Media', semesters: { fall2025: 'T/W/R: Virtual', winter2026: 'T/W: Virtual', spring2026: 'MW/TR: Virtual' } },

  // RELIGION
  { code: 'CREL 101', name: 'Introduction to World Religion', level: 'LOWER', category: 'Religion', semesters: { fall2025: 'R: Virtual', winter2026: 'W: Virtual' } },

  // SOCIOLOGY (Liberal)
  { code: 'CSOC 103', name: 'How Society Works', level: 'LOWER', category: 'Sociology', antireq: 'SOC104', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CSOC 202', name: 'Popular Culture', level: 'LOWER', category: 'Sociology', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CSOC 203', name: 'Social Class and Inequality', level: 'LOWER', category: 'Sociology', semesters: { winter2026: 'R: Virtual', spring2026: 'Online' } },
  { code: 'CSOC 506', name: 'Health and Society', level: 'UPPER', category: 'Sociology', prereq: true, semesters: { fall2025: 'W: Virtual', spring2026: 'TR: Virtual' } },
  { code: 'CSOC 507', name: 'Race and Ethnicity in Canadian Society', level: 'UPPER', category: 'Sociology', semesters: { fall2025: 'R: Virtual', winter2026: 'T: Virtual', spring2026: 'TR: Virtual' } },
  { code: 'CSOC 603', name: 'Sociology of Gender', level: 'UPPER', category: 'Sociology', prereq: true, semesters: { fall2025: 'T: Virtual', winter2026: 'T: Virtual', spring2026: 'MW: Virtual' } },
  { code: 'CSOC 633', name: 'Sexualities, Identities and Society', level: 'UPPER', category: 'Sociology', semesters: { fall2025: 'R: Virtual', winter2026: 'R: Virtual', spring2026: 'TR: Virtual' } },
  { code: 'CSOC 808', name: 'Sociology of Food and Eating', level: 'LOWER', category: 'Sociology', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CSOC 880', name: 'Information Technology and Society', level: 'UPPER', category: 'Sociology', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CSOC 885', name: 'Women and Islam', level: 'UPPER', category: 'Sociology', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },

  // SPANISH
  { code: 'CSPN 101', name: 'Introductory Spanish I', level: 'LOWER', category: 'Spanish', semesters: { fall2025: 'M/T: Virtual', winter2026: 'T: TBA', spring2026: 'TR: Virtual', summer2026: 'MW: Virtual' } },
  { code: 'CSPN 201', name: 'Introductory Spanish II', level: 'LOWER', category: 'Spanish', prereq: true, semesters: { summer2026: 'TR: Virtual' } },
  { code: 'CSPN 301', name: 'Intermediate Spanish I', level: 'BOTH', category: 'Spanish', prereq: true, semesters: { winter2026: 'W: Virtual', spring2026: 'MW: Virtual' } },
];

export const OPEN_ELECTIVE_COURSES: ElectiveCourse[] = [
  // ACCOUNTING
  { code: 'CACC 100', name: 'Introductory Financial Accounting', level: 'LOWER', category: 'Accounting', antireq: 'ACC110', semesters: { fall2025: 'T; Online', winter2026: 'T: Virtual; Online', spring2026: 'Online' } },
  { code: 'CACC 110', name: 'Financial Accounting', level: 'LOWER', category: 'Accounting', antireq: 'ACC100', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CACC 333', name: 'Core Concepts of Accounting', level: 'UPPER', category: 'Accounting', prereq: true, semesters: { spring2026: 'W: Virtual' } },
  { code: 'CACC 406', name: 'Introductory Management Accounting I', level: 'UPPER', category: 'Accounting', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CACC 410', name: 'Management Accounting', level: 'UPPER', category: 'Accounting', prereq: true, semesters: { spring2026: 'Online' } },
  { code: 'CACC 450', name: 'Intermediate Financial Accounting', level: 'UPPER', category: 'Accounting', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online' } },
  { code: 'CACC 521', name: 'Auditing', level: 'UPPER', category: 'Accounting', prereq: true, semesters: { winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CACC 522', name: 'Taxation for Managers and Financial Planners', level: 'UPPER', category: 'Accounting', prereq: true, semesters: { spring2026: 'W: Virtual' } },
  { code: 'CACC 550', name: 'Intermediate Financial Accounting II', level: 'UPPER', category: 'Accounting', prereq: true, semesters: { winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CACC 696', name: 'Information Systems Audit and Data Analytics', level: 'UPPER', category: 'Accounting', prereq: true, semesters: { winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CACC 703', name: 'Advanced Financial Accounting', level: 'UPPER', category: 'Accounting', prereq: true, semesters: { spring2026: 'Online' } },
  { code: 'CACC 750', name: 'Taxation', level: 'UPPER', category: 'Accounting', prereq: true, semesters: { winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CACC 801', name: 'Intermediate Cost and Management Accounting', level: 'UPPER', category: 'Accounting', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online' } },
  { code: 'CACC 842', name: 'Canadian Business Taxation II', level: 'UPPER', category: 'Accounting', prereq: true, semesters: { fall2025: 'Online' } },

  // BUSINESS COMMUNICATIONS
  { code: 'CCMN 114', name: 'Short Management Reports', level: 'LOWER', category: 'Communications', semesters: { fall2025: 'W; Online', winter2026: 'T; Online', spring2026: 'Online' } },
  { code: 'CCMN 279', name: 'Introduction to Professional Communication', level: 'LOWER', category: 'Communications', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CCMN 288', name: 'Communities and Social Media', level: 'LOWER', category: 'Communications', semesters: { spring2026: 'T: Virtual' } },
  { code: 'CCMN 304', name: 'Career Advancement Communications', level: 'UPPER', category: 'Communications', semesters: { fall2025: 'Online', spring2026: 'Online' } },
  { code: 'CCMN 313', name: 'Organizational Problem Solving and Report Writing', level: 'UPPER', category: 'Communications', prereq: true, semesters: { winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CCMN 314', name: 'Professional Presentations', level: 'UPPER', category: 'Communications', prereq: true, semesters: { fall2025: 'W/R: Virtual', winter2026: 'R: Virtual', spring2026: 'Online' } },
  { code: 'CCMN 315', name: 'Issues in Organizational Communications', level: 'UPPER', category: 'Communications', prereq: true, semesters: { fall2025: 'W', winter2026: 'T: Virtual; Online', spring2026: 'Online' } },
  { code: 'CCMN 408', name: 'Proposal and Grant Writing', level: 'UPPER', category: 'Communications', semesters: { spring2026: 'R: Virtual' } },
  { code: 'CCMN 413', name: 'Corporate Communications', level: 'UPPER', category: 'Communications', prereq: true, semesters: { fall2025: 'Online', spring2026: 'Online' } },
  { code: 'CCMN 414', name: 'Interpersonal Communications', level: 'UPPER', category: 'Communications', prereq: true, semesters: { winter2026: 'R', spring2026: 'R' } },
  { code: 'CCMN 443', name: 'Contemporary Intercultural Communications', level: 'UPPER', category: 'Communications', prereq: true, semesters: { fall2025: 'R: Virtual', spring2026: 'W: Virtual' } },

  // CRIMINOLOGY (OE)
  { code: 'CCRM 100', name: 'Introduction to Canadian Criminal Justice', level: 'LOWER', category: 'Criminology', antireq: 'CRM101', semesters: { fall2025: 'T/W: Virtual', winter2026: 'T/W: Virtual', spring2026: 'TR: Virtual' } },
  { code: 'CCRM 102', name: 'Introduction to Criminology', level: 'LOWER', category: 'Criminology', antireq: 'CRM101', semesters: { fall2025: 'W: Virtual', winter2026: 'T/W: Virtual', summer2026: 'TR: Virtual' } },
  { code: 'CCRM 200', name: 'Criminal Law', level: 'UPPER', category: 'Criminology', prereq: true, semesters: { fall2025: 'TBA: Virtual', winter2026: 'R: Virtual' } },
  { code: 'CCRM 300', name: 'Policing in Canada', level: 'UPPER', category: 'Criminology', prereq: true, semesters: { fall2025: 'M: Virtual' } },
  { code: 'CCRM 302', name: 'Criminological Theories', level: 'UPPER', category: 'Criminology', prereq: true, semesters: { spring2026: 'Online' } },
  { code: 'CCRM 318', name: 'Violence and Communities', level: 'UPPER', category: 'Criminology', semesters: { fall2025: 'Online', winter2026: 'Online' } },
  { code: 'CCRM 402', name: 'Criminal Justice and Social Inequality', level: 'UPPER', category: 'Criminology', semesters: { winter2026: 'M: Virtual' } },

  // ECONOMICS (OE)
  { code: 'CECN 104', name: 'Introductory Microeconomics', level: 'LOWER', category: 'Economics', antireq: 'ECN110', semesters: { fall2025: 'W; Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CECN 204', name: 'Introductory Macroeconomics', level: 'LOWER', category: 'Economics', antireq: 'ECN210', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CECN 301', name: 'Intermediate Macroeconomics I', level: 'UPPER', category: 'Economics', prereq: true, semesters: { fall2025: 'R: Virtual', winter2026: 'R/F: TBA', spring2026: 'MW: Virtual' } },
  { code: 'CECN 321', name: 'Introduction to Law and Economics', level: 'UPPER', category: 'Economics', prereq: true, semesters: { winter2026: 'Online' } },
  { code: 'CECN 504', name: 'Intermediate Microeconomics I', level: 'UPPER', category: 'Economics', prereq: true, semesters: { fall2025: 'T/F: Virtual', winter2026: 'T/F: Virtual', spring2026: 'TR: Virtual' } },
  { code: 'CECN 506', name: 'Money and Banking', level: 'UPPER', category: 'Economics', prereq: true, semesters: { spring2026: 'Online' } },
  { code: 'CECN 600', name: 'Intermediate Macroeconomics II', level: 'UPPER', category: 'Economics', prereq: true, semesters: { winter2026: 'M/F: Virtual', summer2026: 'TR: Virtual' } },
  { code: 'CECN 606', name: 'International Monetary Economics', level: 'UPPER', category: 'Economics', prereq: true, semesters: { fall2025: 'Online', spring2026: 'Online' } },
  { code: 'CECN 620', name: 'Applied Economic Analysis', level: 'UPPER', category: 'Economics', prereq: true, semesters: { fall2025: 'T/W: Virtual', winter2026: 'W/R: Virtual', spring2026: 'Online' } },
  { code: 'CECN 627', name: 'Econometrics', level: 'UPPER', category: 'Economics', prereq: true, semesters: { spring2026: 'MW: Virtual' } },
  { code: 'CECN 640', name: 'Economics of Immigration', level: 'UPPER', category: 'Economics', prereq: true, semesters: { fall2025: 'W: Virtual', winter2026: 'W: Virtual', summer2026: 'MW: Virtual' } },
  { code: 'CECN 700', name: 'Intermediate Microeconomics II', level: 'UPPER', category: 'Economics', prereq: true, semesters: { winter2026: 'W/F: Virtual', summer2026: 'MW: Virtual' } },
  { code: 'CECN 702', name: 'Econometrics II', level: 'UPPER', category: 'Economics', prereq: true, semesters: { summer2026: 'MW: Virtual' } },
  { code: 'CECN 707', name: 'Economics of International Trade', level: 'UPPER', category: 'Economics', prereq: true, semesters: { spring2026: 'Online' } },

  // ENGLISH (OE)
  { code: 'CENG 110', name: 'Literatures Across Borders', level: 'LOWER', category: 'English', semesters: { fall2025: 'T: Virtual', winter2026: 'T: Virtual', spring2026: 'TR: Virtual' } },
  { code: 'CENG 222', name: 'Fairy Tales and Fantasies', level: 'LOWER', category: 'English', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CENG 224', name: "Children's Literature", level: 'LOWER', category: 'English', semesters: { winter2026: 'R: Virtual', summer2026: 'TR: Virtual' } },
  { code: 'CENG 230', name: 'Creativity, Writing and Everyday Life', level: 'LOWER', category: 'English', semesters: { fall2025: 'T: Virtual', winter2026: 'T: Virtual' } },
  { code: 'CENG 706', name: 'Shakespeare and Performance', level: 'UPPER', category: 'English', prereq: true, semesters: { winter2026: 'T: Virtual', spring2026: 'MW: Virtual' } },
  { code: 'CSSH 102', name: 'Learning and Development Strategies', level: 'LOWER', category: 'Social Sciences', semesters: { winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CSSH 205', name: 'Academic Writing and Research', level: 'LOWER', category: 'Social Sciences', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'TR: Virtual' } },

  // DISABILITY STUDIES
  { code: 'CDST 504', name: "Mad People's History", level: 'UPPER', category: 'Disability Studies', semesters: { fall2025: 'Online', winter2026: 'Online' } },
  { code: 'CDST 506', name: 'Making Ontario Accessible', level: 'UPPER', category: 'Disability Studies', semesters: { fall2025: 'Online' } },

  // FAMILY STUDIES
  { code: 'CFNF 400', name: 'The Social Content of Human Sexuality', level: 'UPPER', category: 'Family Studies', semesters: { fall2025: 'Online', winter2026: 'Online' } },

  // FINANCE
  { code: 'CFIN 300', name: 'Managerial Finance I', level: 'UPPER', category: 'Finance', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CFIN 401', name: 'Managerial Finance II', level: 'UPPER', category: 'Finance', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CFIN 501', name: 'Investment Analysis I', level: 'UPPER', category: 'Finance', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CFIN 502', name: 'Personal Financial Planning', level: 'UPPER', category: 'Finance', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CFIN 512', name: 'Risk Management and Insurance', level: 'UPPER', category: 'Finance', prereq: true, semesters: { winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CFIN 612', name: 'Retirement and Estate Planning', level: 'UPPER', category: 'Finance', prereq: true, semesters: { spring2026: 'Online' } },
  { code: 'CFIN 621', name: 'International Finance', level: 'UPPER', category: 'Finance', prereq: true, semesters: { spring2026: 'Online' } },

  // FOOD SECURITY
  { code: 'CFNY 403', name: 'Food Security Concepts and Principles', level: 'UPPER', category: 'Food Security', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CFNY 404', name: 'Food Policy and Programs for Food Security', level: 'UPPER', category: 'Food Security', semesters: { spring2026: 'Online' } },

  // GEOGRAPHY (OE)
  { code: 'CGEO 151', name: 'Location, Location, Location', level: 'LOWER', category: 'Geography', antireq: 'PLG300', semesters: { fall2025: 'R: Virtual', spring2026: 'TR: Virtual' } },
  { code: 'CGEO 301', name: 'Marketing Geography', level: 'UPPER', category: 'Geography', semesters: { spring2026: 'TR: Virtual' } },
  { code: 'CGEO 691', name: 'Canadian Immigration: Patterns and Place', level: 'UPPER', category: 'Geography', semesters: { spring2026: 'M: Virtual' } },
  { code: 'CGEO 705', name: 'Environment and Society in the Caribbean', level: 'UPPER', category: 'Geography', semesters: { spring2026: 'R: Virtual' } },

  // GRAPHIC COMMUNICATIONS
  { code: 'CGCM 110', name: 'Intro to Graphic Communications', level: 'LOWER', category: 'Graphic Comm', semesters: { winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CGCM 111', name: 'Graphic Communication Technologies', level: 'LOWER', category: 'Graphic Comm', semesters: { winter2026: 'R: Virtual', spring2026: 'T: Virtual' } },
  { code: 'CGCM 130', name: 'Design and Layout', level: 'LOWER', category: 'Graphic Comm', semesters: { spring2026: 'T/W: Virtual' } },
  { code: 'CGCM 210', name: 'Introduction to Packaging', level: 'LOWER', category: 'Graphic Comm', semesters: { fall2025: 'W: Virtual' } },
  { code: 'CGCM 230', name: 'Typography', level: 'UPPER', category: 'Graphic Comm', prereq: true, semesters: { winter2026: 'W: Virtual' } },
  { code: 'CGCM 720', name: 'Magazine Production and Publishing', level: 'UPPER', category: 'Graphic Comm', prereq: true, semesters: { spring2026: 'Online' } },
  { code: 'CGCM 738', name: 'Photoshopped! The Art of Image Retouching', level: 'UPPER', category: 'Graphic Comm', prereq: true, semesters: { fall2025: 'R: Virtual', spring2026: 'M/R: Virtual' } },
  { code: 'CGCM 740', name: 'Accessibility for Graphic Communications', level: 'UPPER', category: 'Graphic Comm', semesters: { winter2026: 'T: Virtual' } },
  { code: 'CGCM 746', name: 'Sustainability in Print and Packaging', level: 'UPPER', category: 'Graphic Comm', semesters: { fall2025: 'T: Virtual' } },

  // GLOBAL MANAGEMENT
  { code: 'CGMS 200', name: 'Introduction to Global Management', level: 'LOWER', category: 'Global Management', semesters: { fall2025: 'W; Online', winter2026: 'R; Online' } },
  { code: 'CGMS 401', name: 'Operations Management', level: 'UPPER', category: 'Global Management', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online' } },
  { code: 'CGMS 402', name: 'Introduction to Management Economics', level: 'UPPER', category: 'Global Management', prereq: true, semesters: { fall2025: 'W: Virtual', winter2026: 'W: Virtual' } },
  { code: 'CGMS 522', name: 'International Marketing', level: 'UPPER', category: 'Global Management', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online' } },
  { code: 'CGMS 690', name: 'The North American Business Environment', level: 'UPPER', category: 'Global Management', prereq: true, semesters: { fall2025: 'W: Virtual', winter2026: 'W: Virtual' } },
  { code: 'CGMS 724', name: 'Management of International Enterprise', level: 'UPPER', category: 'Global Management', prereq: true, semesters: { fall2025: 'M: Virtual', winter2026: 'M: Virtual' } },

  // HEALTHCARE
  { code: 'CHIM 301', name: 'Healthcare Information Analysis', level: 'UPPER', category: 'Healthcare', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online' } },
  { code: 'CHIM 305', name: 'Introduction to Health Informatics', level: 'UPPER', category: 'Healthcare', semesters: { fall2025: 'Online', winter2026: 'Online' } },
  { code: 'CHSM 301', name: 'The Healthcare System', level: 'UPPER', category: 'Healthcare', semesters: { fall2025: 'Online', winter2026: 'Online' } },
  { code: 'CHSM 305', name: 'The Management Cycle', level: 'UPPER', category: 'Healthcare', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online' } },
  { code: 'CHSM 437', name: 'Human Resources Management in Healthcare', level: 'UPPER', category: 'Healthcare', semesters: { fall2025: 'Online', winter2026: 'Online' } },

  // HISTORY (OE)
  { code: 'CHIS 105', name: 'Inventing Pop Culture', level: 'LOWER', category: 'History', semesters: { summer2026: 'TR: Virtual' } },
  { code: 'CHIS 106', name: 'Technology, Warfare and Social Change', level: 'LOWER', category: 'History', semesters: { spring2026: 'TR: Virtual' } },
  { code: 'CHIS 590', name: 'Modern International Relations', level: 'UPPER', category: 'History', semesters: { spring2026: 'TR: Virtual' } },

  // HR MANAGEMENT
  { code: 'CMHR 523', name: 'Human Resources Management', level: 'UPPER', category: 'HR Management', semesters: { spring2026: 'Online; TW: Virtual' } },

  // IT MANAGEMENT
  { code: 'CITM 102', name: 'Business Information Systems', level: 'LOWER', category: 'IT Management', antireq: 'ITM100', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CITM 107', name: 'Managerial Decision Making', level: 'LOWER', category: 'IT Management', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CITM 200', name: 'Fundamentals of Programming', level: 'LOWER', category: 'IT Management', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CITM 207', name: 'Computer-Enabled Problem Solving', level: 'LOWER', category: 'IT Management', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CITM 305', name: 'Systems Analysis and Design', level: 'UPPER', category: 'IT Management', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CITM 350', name: 'Concepts of e-Business', level: 'UPPER', category: 'IT Management', semesters: { spring2026: 'Online' } },
  { code: 'CITM 410', name: 'Business Process Design', level: 'UPPER', category: 'IT Management', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CITM 500', name: 'Data and Information Management', level: 'UPPER', category: 'IT Management', prereq: true, semesters: { fall2025: 'Online', spring2026: 'Online' } },
  { code: 'CITM 750', name: 'IS Project Management', level: 'UPPER', category: 'IT Management', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CITM 820', name: 'Information Systems Security and Privacy', level: 'UPPER', category: 'IT Management', prereq: true, semesters: { fall2025: 'Online', spring2026: 'Online' } },

  // LAW
  { code: 'CLAW 122', name: 'Business Law', level: 'LOWER', category: 'Law', semesters: { fall2025: 'M; Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CLAW 525', name: 'The Law of the Marketplace', level: 'UPPER', category: 'Law', prereq: true, semesters: { spring2026: 'TR: In-person' } },
  { code: 'CLAW 529', name: 'Employment and Labour Law', level: 'UPPER', category: 'Law', prereq: true, semesters: { winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CLAW 533', name: 'Corporate Social Responsibility and the Law', level: 'UPPER', category: 'Law', prereq: true, semesters: { spring2026: 'TR: Virtual' } },
  { code: 'CLAW 603', name: 'Advanced Business Law', level: 'UPPER', category: 'Law', prereq: true, semesters: { winter2026: 'Online', spring2026: 'Online; TR', summer2026: 'MW' } },
  { code: 'CLAW 723', name: 'Issues in Information Technology Law', level: 'UPPER', category: 'Law', prereq: true, semesters: { spring2026: 'TR: Virtual' } },
  { code: 'CLAW 724', name: 'Legal Aspects of International Business', level: 'UPPER', category: 'Law', prereq: true, semesters: { summer2026: 'TR: Virtual' } },

  // NON-PROFIT MANAGEMENT
  { code: 'CINP 900', name: 'Understanding the Non-Profit Sector', level: 'UPPER', category: 'Non-Profit', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CINP 901', name: 'Effective Non-profit Organizations', level: 'UPPER', category: 'Non-Profit', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CINP 902', name: 'Evaluation for Non-profits', level: 'UPPER', category: 'Non-Profit', antireq: 'PPA402', semesters: { fall2025: 'Online', spring2026: 'TBA' } },
  { code: 'CINP 910', name: 'Strategic Planning for Nonprofits', level: 'UPPER', category: 'Non-Profit', semesters: { fall2025: 'Online', spring2026: 'Online' } },
  { code: 'CINP 911', name: 'Advocacy and Government Relations', level: 'UPPER', category: 'Non-Profit', semesters: { fall2025: 'Online', spring2026: 'Online' } },
  { code: 'CINP 912', name: 'Marketing for Nonprofits', level: 'UPPER', category: 'Non-Profit', semesters: { spring2026: 'Online' } },
  { code: 'CINP 913', name: 'Leadership in Nonprofit', level: 'UPPER', category: 'Non-Profit', semesters: { winter2026: 'Online' } },
  { code: 'CINP 915', name: 'Financial Management for Non-profits', level: 'UPPER', category: 'Non-Profit', antireq: 'PPA303', semesters: { winter2026: 'Online; SAT', spring2026: 'Online' } },
  { code: 'CINP 920', name: 'Critical Issues in the Non-profit', level: 'UPPER', category: 'Non-Profit', prereq: true, semesters: { winter2026: 'Online', spring2026: 'Online' } },

  // OCC HEALTH & SAFETY
  { code: 'COHS 208', name: 'Occupational Health and Safety Law', level: 'LOWER', category: 'OHS', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'COHS 508', name: 'Occupational Health', level: 'UPPER', category: 'OHS', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'COHS 608', name: 'Hazard Recognition and Control', level: 'UPPER', category: 'OHS', semesters: { winter2026: 'Online', spring2026: 'Online' } },
  { code: 'COHS 811', name: 'OHSE Management Systems', level: 'UPPER', category: 'OHS', semesters: { fall2025: 'Online', spring2026: 'Online' } },

  // PHILOSOPHY (OE)
  { code: 'CPHL 302', name: 'Ethics in Health Care', level: 'UPPER', category: 'Philosophy', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CPHL 307', name: 'Business Ethics', level: 'UPPER', category: 'Philosophy', semesters: { fall2025: 'Online', spring2026: 'Online' } },

  // PSYCHOLOGY (OE)
  { code: 'CPSY 102', name: 'Introduction to Psychology I', level: 'LOWER', category: 'Psychology', antireq: 'PSY105', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CPSY 202', name: 'Introduction to Psychology II', level: 'LOWER', category: 'Psychology', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CPSY 215', name: 'Psychology of Addictions', level: 'UPPER', category: 'Psychology', prereq: true, semesters: { fall2025: 'Online', spring2026: 'Online' } },
  { code: 'CPSY 300', name: 'Psychology of Law', level: 'UPPER', category: 'Psychology', prereq: true, semesters: { fall2025: 'Online', spring2026: 'Online' } },
  { code: 'CPSY 302', name: 'Child Development', level: 'UPPER', category: 'Psychology', prereq: true, semesters: { fall2025: 'Online', spring2026: 'Online' } },
  { code: 'CPSY 324', name: 'Biological Psychology', level: 'UPPER', category: 'Psychology', prereq: true, semesters: { fall2025: 'T: Virtual', spring2026: 'Online' } },
  { code: 'CPSY 325', name: 'Psychological Disorders', level: 'UPPER', category: 'Psychology', prereq: true, antireq: 'PSY606', semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CPSY 335', name: 'Clinical Psychology', level: 'UPPER', category: 'Psychology', prereq: true, semesters: { fall2025: 'M: Virtual', summer2026: 'TR: Virtual' } },
  { code: 'CPSY 682', name: 'Sleep', level: 'UPPER', category: 'Psychology', prereq: true, semesters: { spring2026: 'Online' } },
  { code: 'CPSY 808', name: 'Community Psychology', level: 'UPPER', category: 'Psychology', prereq: true, semesters: { summer2026: 'MW: Virtual' } },

  // SOCIOLOGY (OE)
  { code: 'CSOC 107', name: 'Sociology of the Everyday', level: 'LOWER', category: 'Sociology', semesters: { spring2026: 'TR: Virtual' } },
  { code: 'CSOC 502', name: 'Violence and the Family', level: 'UPPER', category: 'Sociology', prereq: true, semesters: { fall2025: 'Online', winter2026: 'Online', spring2026: 'Online' } },
  { code: 'CSOC 605', name: 'Canadian Families: Myth and Legal Reality', level: 'UPPER', category: 'Sociology', prereq: true, semesters: { fall2025: 'T: Virtual', spring2026: 'MW: Virtual' } },
  { code: 'CSOC 606', name: 'Work and Families in the 21st Century', level: 'UPPER', category: 'Sociology', prereq: true, semesters: { winter2026: 'T: Virtual', summer2026: 'MW: Virtual' } },
  { code: 'CSOC 608', name: 'Women, Power and Change', level: 'UPPER', category: 'Sociology', prereq: true, semesters: { fall2025: 'R: Virtual', spring2026: 'TR: Virtual' } },

  // CARIBBEAN (OE)
  { code: 'CCRB 605', name: 'Caribbean Tourism: Impacts and Resistance', level: 'UPPER', category: 'Caribbean Studies', semesters: { spring2026: 'MW: Virtual' } },
];

export const POG_COURSES: ElectiveCourse[] = [
  { code: 'POG 316', name: 'Social Policy', level: 'UPPER', category: 'Politics & Governance', semesters: {} },
  { code: 'POG 317', name: 'Education Politics and Policy', level: 'UPPER', category: 'Politics & Governance', semesters: {} },
  { code: 'POG 411', name: 'Canadian Foreign Policy', level: 'UPPER', category: 'Politics & Governance', semesters: {} },
  { code: 'POG 412', name: 'Government and the Economy', level: 'UPPER', category: 'Politics & Governance', semesters: {} },
  { code: 'POG 415', name: 'Environmental Politics and Policy', level: 'UPPER', category: 'Politics & Governance', semesters: {} },
  { code: 'POG 443', name: 'Global Cities', level: 'UPPER', category: 'Politics & Governance', semesters: {} },
  { code: 'CPOG 417', name: 'Canadian-American Relations', level: 'UPPER', category: 'Politics & Governance', semesters: { spring2026: 'In-person' } },
  { code: 'CPOG 444', name: 'Politics, Media and Technology', level: 'UPPER', category: 'Politics & Governance', semesters: { spring2026: 'TR: Virtual' } },
];

export const getCoursesForLevel = (level: 'LOWER' | 'UPPER' | 'ALL', list: ElectiveCourse[]): ElectiveCourse[] => {
  if (level === 'ALL') return list;
  return list.filter(c => c.level === level || c.level === 'BOTH');
};
