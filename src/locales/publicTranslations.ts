export type PublicLanguage = 'en' | 'si';

export interface PublicTranslations {
  // Header
  appTitle: string;
  operatorLogin: string;
  installApp: string;

  // Box Selector
  locationLabel: string;
  selectBoxTitle: string;
  defaultBoxDescription: string;

  // Category Selection
  helpQuestion: string;
  welcomeMessageDefault: string;
  suggestionTitle: string;
  suggestionBadge: string;
  suggestionDesc: string;
  complaintTitle: string;
  complaintBadge: string;
  complaintDesc: string;
  anonymousGuarantee: string;

  // Form
  backToCategory: string;
  suggestionPrompt: string;
  complaintPrompt: string;
  suggestionPlaceholder: string;
  complaintPlaceholder: string;
  repeatedSubmissionsNote: string;
  characterCount: string;

  // Anonymous toggle & info
  anonymousCheckboxLabel: string;
  anonymousCheckboxSubtext: string;
  optionalNameLabel: string;
  optionalNamePlaceholder: string;
  optionalContactLabel: string;
  optionalContactPlaceholder: string;

  // Submission actions & states
  submittingText: string;
  submitSuggestionBtn: string;
  submitComplaintBtn: string;

  // Validation & error messages
  errorMinLength: string;
  errorMaxLength: string;
  errorGeneric: string;
  errorNetwork: string;

  // Thank You / Confirmation Screen
  thankYouTitle: string;
  thankYouMessageDefault: string;
  thankYouSubtext: string;
  anonymousConfirmedBadge: string;
  namedConfirmedBadge: (name: string) => string;
  submitAnotherBtn: string;

  // Footer
  footerSystemTitle: string;
  footerSecurityNote: string;

  // Language switch
  languageSwitchPrompt: string;
}

export const publicTranslations: Record<PublicLanguage, PublicTranslations> = {
  en: {
    // Header
    appTitle: 'CloudBase Feedback',
    operatorLogin: 'Operator',
    installApp: 'Install App',

    // Box Selector
    locationLabel: 'Feedback Box Location',
    selectBoxTitle: 'Select Digital Feedback Box',
    defaultBoxDescription: 'Public suggestion and feedback box.',

    // Category Selection
    helpQuestion: 'How can we help?',
    welcomeMessageDefault: 'Choose a feedback category to get started. No account needed.',
    suggestionTitle: '💡 Suggestion',
    suggestionBadge: '💡 Suggestion',
    suggestionDesc: 'Have an idea or improvement? Share what would make things better.',
    complaintTitle: '⚠ Complaint',
    complaintBadge: '⚠ Complaint',
    complaintDesc: 'Experiencing a problem or issue? Let our operators look into it.',
    anonymousGuarantee: 'You can submit this feedback anonymously.',

    // Form
    backToCategory: 'Change category',
    suggestionPrompt: 'How can we improve?',
    complaintPrompt: 'Please tell us about the issue.',
    suggestionPlaceholder: 'Write your suggestion here... What would you like to see improved or introduced?',
    complaintPlaceholder: 'Describe your complaint here... What happened and what needs attention?',
    repeatedSubmissionsNote: 'Repeated submissions are valued and welcome.',
    characterCount: 'characters',

    // Anonymous toggle & info
    anonymousCheckboxLabel: 'Submit anonymously',
    anonymousCheckboxSubtext: "Your identity and contact info won't be recorded or shared.",
    optionalNameLabel: 'Name (optional)',
    optionalNamePlaceholder: 'Your name',
    optionalContactLabel: 'Contact (optional)',
    optionalContactPlaceholder: 'Email, extension, or phone',

    // Submission actions & states
    submittingText: 'Submitting...',
    submitSuggestionBtn: 'Submit Suggestion',
    submitComplaintBtn: 'Submit Complaint',

    // Validation & error messages
    errorMinLength: 'Please write at least 3 characters before submitting.',
    errorMaxLength: 'Your feedback exceeds the maximum allowed length of 2000 characters.',
    errorGeneric: 'Failed to submit feedback. Please try again.',
    errorNetwork: 'An unexpected error occurred. Please check your network connection.',

    // Thank You / Confirmation Screen
    thankYouTitle: 'Thank You!',
    thankYouMessageDefault: 'Your feedback has been submitted successfully.',
    thankYouSubtext: 'Your feedback helps us improve. You may close this page now.',
    anonymousConfirmedBadge: 'Your submission is 100% anonymous.',
    namedConfirmedBadge: (name: string) => `Submitted as: ${name || 'Named Submitter'}`,
    submitAnotherBtn: 'Submit Another Feedback',

    // Footer
    footerSystemTitle: 'CloudBase Digital Feedback System',
    footerSecurityNote: 'Multi-tenant D1 Secure Engine',

    // Language switch
    languageSwitchPrompt: 'Language / භාෂාව',
  },

  si: {
    // Header
    appTitle: 'CloudBase ඩිජිටල් අදහස් පෙට්ටිය',
    operatorLogin: 'පරිපාලක පිවිසුම',
    installApp: 'යෙදුම ස්ථාපනය කරන්න',

    // Box Selector
    locationLabel: 'අදහස් පෙට්ටිය පිහිටි ස්ථානය',
    selectBoxTitle: 'අදාළ අදහස් පෙට්ටිය තෝරන්න',
    defaultBoxDescription: 'කාර්ය මණ්ඩලය සහ මහජනතාව සඳහා වන ඩිජිටල් අදහස් සහ යෝජනා පෙට්ටිය.',

    // Category Selection - Natural Native Sri Lankan Sinhala
    helpQuestion: 'ඔබේ අදහස හෝ ගැටලුව අපට දන්වන්න',
    welcomeMessageDefault: 'ආයතනයේ උන්නතිය සහ කාර්යාල පහසුව සඳහා ඔබේ වටිනා යෝජනා හෝ මුහුණ දෙන ගැටලු කිසිදු පැකිලීමකින් තොරව අප වෙත යොමු කරන්න.',
    suggestionTitle: '💡 යහපත් යෝජනාවක්',
    suggestionBadge: '💡 යහපත් යෝජනාවකි',
    suggestionDesc: 'වැඩබිම, ආහාර, පරිසරය හෝ සේවාව තවදුරටත් දියුණු කිරීමට අලුත් අදහසක් තිබේද? ඒ ගැන අපට කියන්න.',
    complaintTitle: '⚠ ගැටලුවක් / පැමිණිල්ලක්',
    complaintBadge: '⚠ විසඳිය යුතු ගැටලුවකි',
    complaintDesc: 'රාජකාරියේදී හෝ පරිශ්‍රයේදී ඔබට යම් අපහසුතාවක් හෝ නොවිසඳුණු ගැටලුවක් ඇත්නම්, වගකිවයුතු අංශවල අවධානයට යොමු කරන්න.',
    anonymousGuarantee: 'ඔබේ නම හෝ අනන්‍යතාවය හෙළි නොකර (රහසිගතව) මෙම අදහස ඉදිරිපත් කළ හැක.',

    // Form
    backToCategory: 'අංශය වෙනස් කරන්න',
    suggestionPrompt: 'ඔබේ යෝජනාව පැහැදිලි කරන්න:',
    complaintPrompt: 'ඔබ මුහුණ දෙන ගැටලුව හෝ අපහසුතාව විස්තර කරන්න:',
    suggestionPlaceholder: 'මෙම තත්ත්වය වඩාත් යහපත් කරගත හැක්කේ කෙසේද? ඔබේ අදහස් මෙහි පැහැදිලිව සටහන් කරන්න...',
    complaintPlaceholder: 'සිදුවූයේ කුමක්ද? නිවැරදි විය යුත්තේ කුමක්ද? ගැටලුව පිළිබඳ විස්තර මෙහි සටහන් කරන්න...',
    repeatedSubmissionsNote: 'නැවත නැවත ඉදිරිපත් කරනු ලබන අදහස් ද ඉතා සාදරයෙන් පිළිගනිමු.',
    characterCount: 'අකුරු',

    // Anonymous toggle & info
    anonymousCheckboxLabel: 'මගේ නම හෙළි නොකර රහසිගතව යොමු කරන්න (නිර්නාමිකයි)',
    anonymousCheckboxSubtext: 'ඔබේ නම, දුරකථන අංකය හෝ කිසිදු පෞද්ගලික තොරතුරක් සටහන් නොවන අතර 100% ක් රහසිගතව සුරැකේ.',
    optionalNameLabel: 'ඔබේ නම (කැමති නම් පමණක්)',
    optionalNamePlaceholder: 'නම මෙහි සටහන් කරන්න',
    optionalContactLabel: 'දුරකථන අංකය හෝ විද්‍යුත් තැපෑල (කැමති නම් පමණක්)',
    optionalContactPlaceholder: '07x xxxxxxx හෝ විද්‍යුත් ලිපිනය',

    // Submission actions & states
    submittingText: 'යොමු කරමින් පවතී...',
    submitSuggestionBtn: 'යෝජනාව යොමු කරන්න',
    submitComplaintBtn: 'පැමිණිල්ල යොමු කරන්න',

    // Validation & error messages
    errorMinLength: 'කරුණාකර අවම වශයෙන් අකුරු 3 කින් යුත් පණිවිඩයක් ලියන්න.',
    errorMaxLength: 'ඔබේ පණිවිඩය උපරිම අකුරු 2000 සීමාව ඉක්මවා ඇත.',
    errorGeneric: 'අදහස යොමු කිරීමේදී දෝෂයක් ඇති විය. කරුණාකර නැවත උත්සාහ කරන්න.',
    errorNetwork: 'සම්බන්ධතා දෝෂයක් ඇති විය. කරුණාකර අන්තර්ජාල සම්බන්ධතාව පරීක්ෂා කර නැවත උත්සාහ කරන්න.',

    // Thank You / Confirmation Screen
    thankYouTitle: 'බොහොම ස්තූතියි!',
    thankYouMessageDefault: 'ඔබේ අදහස අපගේ පද්ධතියට සාර්ථකව ලැබුණි.',
    thankYouSubtext: 'ආයතනය වඩාත් යහපත් තැනක් බවට පත් කිරීමට ඔබ දැක්වූ උනන්දුව සහ සහයෝගය අපි ඉමහත් ගෞරවයෙන් අගය කරමු. ඔබට දැන් මෙම පිටුව වසා දැමිය හැක.',
    anonymousConfirmedBadge: 'මෙම අදහස 100% ක් නිර්නාමිකව සහ රහසිගතව සටහන් කරගන්නා ලදී.',
    namedConfirmedBadge: (name: string) => `ඉදිරිපත් කළේ: ${name || 'නම සඳහන් කළ සාමාජිකයෙක්'}`,
    submitAnotherBtn: 'තවත් අදහසක් හෝ ගැටලුවක් යොමු කරන්න',

    // Footer
    footerSystemTitle: 'CloudBase ඩිජිටල් අදහස් සහ යෝජනා පද්ධතිය',
    footerSecurityNote: 'රහස්‍යතා සුරක්ෂිත පද්ධතිය',

    // Language switch
    languageSwitchPrompt: 'භාෂාව / Language',
  },
};
