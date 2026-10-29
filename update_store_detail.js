const fs = require('fs');
const path = 'mobile_app/lib/features/customer/screens/store_detail_screen.dart';
let content = fs.readFileSync(path, 'utf8');

const target1 = [
  "                                          Column(",
  "                                            crossAxisAlignment: CrossAxisAlignment.start,",
  "                                            children: [",
  "                                              Text(",
  "                                                '\\$${prod.price.toStringAsFixed(2)}',",
  "                                                style: GoogleFonts.outfit(",
  "                                                  fontSize: 16,",
  "                                                  fontWeight: FontWeight.w900,",
  "                                                  color: AppTheme.primary,",
  "                                                ),",
  "                                              ),",
  "                                              Text(",
  "                                                'Bs. ${(prod.price * 36.5).toStringAsFixed(2)}',",
  "                                                style: GoogleFonts.outfit(",
  "                                                  fontSize: 11,",
  "                                                  fontWeight: FontWeight.w600,",
  "                                                  color: const Color(0xFF65A30D),",
  "                                                ),",
  "                                              ),",
  "                                            ],",
  "                                          ),",
  "                                          Container(",
  "                                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),",
  "                                            decoration: BoxDecoration(",
  "                                              color: AppTheme.primary.withOpacity(0.12),",
  "                                              borderRadius: BorderRadius.circular(10),",
  "                                              border: Border.all(color: AppTheme.primary.withOpacity(0.3)),",
  "                                            ),",
  "                                            child: Text(",
  "                                              '+ Agregar',",
  "                                              style: GoogleFonts.outfit(",
  "                                                fontSize: 12,",
  "                                                fontWeight: FontWeight.w700,",
  "                                                color: AppTheme.primary,",
  "                                              ),",
  "                                            ),",
  "                                          ),"
].join('\n');

const repl1 = [
  "                                          Builder(",
  "                                            builder: (_) {",
  "                                              final usd = prod.price;",
  "                                              final bs = usd * rate;",
  "                                              final usdStr = '\\$${usd.toStringAsFixed(2)}';",
  "                                              final bsStr = 'Bs. ${bs.toStringAsFixed(2)}';",
  "",
  "                                              if (displayMode == 'only_usd') {",
  "                                                return Text(",
  "                                                  usdStr,",
  "                                                  style: GoogleFonts.outfit(",
  "                                                    fontSize: 16,",
  "                                                    fontWeight: FontWeight.w900,",
  "                                                    color: storeAccent,",
  "                                                  ),",
  "                                                );",
  "                                              } else if (displayMode == 'only_bs') {",
  "                                                return Text(",
  "                                                  bsStr,",
  "                                                  style: GoogleFonts.outfit(",
  "                                                    fontSize: 15,",
  "                                                    fontWeight: FontWeight.w900,",
  "                                                    color: const Color(0xFF65A30D),",
  "                                                  ),",
  "                                                );",
  "                                              } else if (displayMode == 'bs_and_usd') {",
  "                                                return Column(",
  "                                                  crossAxisAlignment: CrossAxisAlignment.start,",
  "                                                  children: [",
  "                                                    Text(",
  "                                                      bsStr,",
  "                                                      style: GoogleFonts.outfit(",
  "                                                        fontSize: 15,",
  "                                                        fontWeight: FontWeight.w900,",
  "                                                        color: const Color(0xFF65A30D),",
  "                                                      ),",
  "                                                    ),",
  "                                                    Text(",
  "                                                      usdStr,",
  "                                                      style: GoogleFonts.outfit(",
  "                                                        fontSize: 11,",
  "                                                        fontWeight: FontWeight.w600,",
  "                                                        color: storeAccent,",
  "                                                      ),",
  "                                                    ),",
  "                                                  ],",
  "                                                );",
  "                                              } else {",
  "                                                return Column(",
  "                                                  crossAxisAlignment: CrossAxisAlignment.start,",
  "                                                  children: [",
  "                                                    Text(",
  "                                                      usdStr,",
  "                                                      style: GoogleFonts.outfit(",
  "                                                        fontSize: 16,",
  "                                                        fontWeight: FontWeight.w900,",
  "                                                        color: storeAccent,",
  "                                                      ),",
  "                                                    ),",
  "                                                    Text(",
  "                                                      bsStr,",
  "                                                      style: GoogleFonts.outfit(",
  "                                                        fontSize: 11,",
  "                                                        fontWeight: FontWeight.w600,",
  "                                                        color: const Color(0xFF65A30D),",
  "                                                      ),",
  "                                                    ),",
  "                                                  ],",
  "                                                );",
  "                                              }",
  "                                            },",
  "                                          ),",
  "                                          Container(",
  "                                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),",
  "                                            decoration: BoxDecoration(",
  "                                              color: storeAccent.withOpacity(0.12),",
  "                                              borderRadius: BorderRadius.circular(10),",
  "                                              border: Border.all(color: storeAccent.withOpacity(0.3)),",
  "                                            ),",
  "                                            child: Text(",
  "                                              '+ Agregar',",
  "                                              style: GoogleFonts.outfit(",
  "                                                fontSize: 12,",
  "                                                fontWeight: FontWeight.w700,",
  "                                                color: storeAccent,",
  "                                              ),",
  "                                            ),",
  "                                          ),"
].join('\n');

if (!content.includes(target1)) {
  console.error('Target 1 not found!');
  process.exit(1);
}
content = content.replace(target1, repl1);

const target2 = [
  "                    gradient: const LinearGradient(",
  "                      colors: [Color(0xFFEA580C), Color(0xFFF97316)],",
  "                    ),",
  "                    borderRadius: BorderRadius.circular(20),",
  "                    boxShadow: [",
  "                      BoxShadow(",
  "                        color: const Color(0xFFEA580C).withOpacity(0.4),",
  "                        blurRadius: 20,",
  "                        offset: const Offset(0, 8),",
  "                      ),",
  "                    ],"
].join('\n');

const repl2 = [
  "                    gradient: LinearGradient(",
  "                      colors: [storeAccent, storeAccent.withOpacity(0.85)],",
  "                    ),",
  "                    borderRadius: BorderRadius.circular(20),",
  "                    boxShadow: [",
  "                      BoxShadow(",
  "                        color: storeAccent.withOpacity(0.4),",
  "                        blurRadius: 20,",
  "                        offset: const Offset(0, 8),",
  "                      ),",
  "                    ],"
].join('\n');

if (!content.includes(target2)) {
  console.error('Target 2 not found!');
  process.exit(1);
}
content = content.replace(target2, repl2);

const target3 = [
  "                                Text(",
  "                                  '\\$${cart.subtotal.toStringAsFixed(2)}',",
  "                                  style: GoogleFonts.outfit(",
  "                                    fontSize: 17,",
  "                                    fontWeight: FontWeight.w900,",
  "                                    color: Colors.white,",
  "                                  ),",
  "                                ),"
].join('\n');

const repl3 = [
  "                                Text(",
  "                                  DolarApiService().formatPrice(",
  "                                    cart.subtotal,",
  "                                    customRate: rate,",
  "                                    displayMode: displayMode,",
  "                                  ),",
  "                                  style: GoogleFonts.outfit(",
  "                                    fontSize: 17,",
  "                                    fontWeight: FontWeight.w900,",
  "                                    color: Colors.white,",
  "                                  ),",
  "                                ),"
].join('\n');

if (!content.includes(target3)) {
  console.error('Target 3 not found!');
  process.exit(1);
}
content = content.replace(target3, repl3);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated store_detail_screen.dart!');
